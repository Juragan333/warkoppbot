const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("❌ TOKEN belum diset!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: true,
  request: { timeout: 30000 }
});

console.log("🤖 Bot Anti No Username + Captcha Aktif...");

// Simpan user yg lagi captcha
const captchaUsers = new Map();

// Handle user join
bot.on("message", async (msg) => {
  try {

    if (!msg.new_chat_members) return;

    const chatId = msg.chat.id;

    for (const user of msg.new_chat_members) {

      const userId = user.id;

      // 1. Tanpa username = BAN
      if (!user.username) {
        await bot.banChatMember(chatId, userId);
        console.log("Blocked (no username):", userId);
        continue;
      }

      // 2. Mute user
      await bot.restrictChatMember(chatId, userId, {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false
      });

      // 3. Kirim captcha
      const sent = await bot.sendMessage(
        chatId,
        `👋 Halo ${user.first_name}!\n\nKlik tombol di bawah untuk verifikasi 👇`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Saya Manusia",
                  callback_data: `captcha_${userId}`
                }
              ]
            ]
          }
        }
      );

      // Simpan data
      captchaUsers.set(userId, {
        chatId,
        msgId: sent.message_id
      });

      // 4. Timeout 60 detik → BAN
      setTimeout(async () => {

        if (!captchaUsers.has(userId)) return;

        try {
          await bot.banChatMember(chatId, userId);
          captchaUsers.delete(userId);
          console.log("Blocked (timeout):", userId);
        } catch (e) {}

      }, 60000);
    }

  } catch (err) {
    console.log("Join error:", err.message);
  }
});

// Handle captcha klik
bot.on("callback_query", async (q) => {
  try {

    if (!q.data.startsWith("captcha_")) return;

    const userId = Number(q.data.split("_")[1]);

    // Bukan pemilik captcha
    if (q.from.id !== userId) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Ini bukan captcha kamu!",
        show_alert: true
      });
    }

    const data = captchaUsers.get(userId);

    if (!data) return;

    // 5. UNMUTE user
    await bot.restrictChatMember(data.chatId, userId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
      can_change_info: false,
      can_pin_messages: false
    });

    // Data user
    const name =
      (q.from.first_name || "") +
      " " +
      (q.from.last_name || "");

    const username = q.from.username
      ? "@" + q.from.username
      : "Tidak ada";

    const id = q.from.id;

    // 6. Welcome message
    await bot.sendMessage(
      data.chatId,
      `🎉 *Verifikasi Berhasil!*\n\n` +
      `👤 Nama: ${name.trim()}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 ID: ${id}\n\n` +
      `✅ Selamat datang di grup!`,
      { parse_mode: "Markdown" }
    );

    // Hapus captcha
    await bot.deleteMessage(data.chatId, data.msgId).catch(() => {});

    captchaUsers.delete(userId);

    await bot.answerCallbackQuery(q.id, {
      text: "✅ Verifikasi sukses!"
    });

    console.log("Verified:", id);

  } catch (err) {
    console.log("Captcha error:", err.message);
  }
});

// Handle polling error
bot.on("polling_error", (err) => {
  console.log("Polling error:", err.message);
});
