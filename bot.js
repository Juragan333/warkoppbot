const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("TOKEN belum diset!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot Captcha + Anti No Username Aktif...");

// Simpan user captcha
const captchaUsers = new Map();

/* =========================
   SAAT MEMBER MASUK
========================= */
bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {

    const userId = user.id;

    // Kalau tidak ada username → captcha
    if (!user.username) {

      try {

        // Mute dulu
        await bot.restrictChatMember(chatId, userId, {
          permissions: {
            can_send_messages: false,
            can_send_media_messages: false,
            can_send_polls: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false,
            can_change_info: false,
            can_invite_users: false,
            can_pin_messages: false
          }
        });

        // Simpan captcha
        captchaUsers.set(userId, chatId);

        // Kirim captcha
        await bot.sendMessage(chatId,
          `👋 Halo ${user.first_name}!\n\n` +
          `Silakan klik tombol di bawah untuk verifikasi 👇`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Saya Bukan Bot",
                    callback_data: `captcha_${userId}`
                  }
                ]
              ]
            }
          }
        );

        console.log("Captcha dikirim:", userId);

      } catch (err) {
        console.log("Error mute:", err.message);
      }
    }
  }
});


/* =========================
   SAAT CAPTCHA DIKLIK
========================= */
bot.on("callback_query", async (query) => {

  try {

    const data = query.data;

    if (!data.startsWith("captcha_")) return;

    const userId = parseInt(data.split("_")[1]);
    const clicker = query.from.id;

    // Pastikan yg klik adalah orangnya
    if (userId !== clicker) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Ini bukan captcha kamu!",
        show_alert: true
      });
    }

    const chatId = captchaUsers.get(userId);

    if (!chatId) {
      return bot.answerCallbackQuery(query.id, {
        text: "⚠️ Data captcha hilang, ulang join ya",
        show_alert: true
      });
    }

    // Buka mute
    await bot.restrictChatMember(chatId, userId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: false
      }
    });

    // Data user
    const first = query.from.first_name || "-";
    const last = query.from.last_name || "";
    const name = `${first} ${last}`.trim();

    const username = query.from.username
      ? "@" + query.from.username
      : "Tidak ada";

    const id = query.from.id;

    // Welcome
    await bot.sendMessage(chatId,
      `🎉 *Verifikasi Berhasil!*\n\n` +
      `👤 Nama: ${name}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 ID: ${id}\n\n` +
      `✅ Selamat datang!`,
      { parse_mode: "Markdown" }
    );

    // Hapus captcha
    captchaUsers.delete(userId);

    // Hapus pesan tombol
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

    // Jawab klik
    await bot.answerCallbackQuery(query.id, {
      text: "✅ Verifikasi sukses!"
    });

    console.log("Verified:", userId);

  } catch (err) {
    console.log("Captcha error:", err.message);
  }

});


/* =========================
   ERROR HANDLER
========================= */
bot.on("polling_error", (err) => {
  console.log("Polling error:", err.message);
});
