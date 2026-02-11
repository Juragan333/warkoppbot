const TelegramBot = require("node-telegram-bot-api");

// Token dari ENV Railway
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("❌ TOKEN belum diset!");
  process.exit(1);
}

// Start bot
const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot Captcha + Anti No Username Aktif...");

// Simpan data captcha
// userId => { chatId, msgId, timeout }
const captchaUsers = new Map();

// Timeout 2 menit
const CAPTCHA_TIMEOUT = 2 * 60 * 1000;


/* =========================
   SAAT USER MASUK
========================= */
bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {
    const userId = user.id;

    // Hanya user tanpa username
    if (!user.username) {
      try {

        // MUTE (FORMAT BENAR)
        await bot.restrictChatMember(chatId, userId, {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_invite_users: false,
          can_pin_messages: false
        });

        // Kirim captcha
        const sent = await bot.sendMessage(
          chatId,
          `👋 Halo *${user.first_name}*\n\n` +
          `Klik tombol di bawah untuk verifikasi 👇\n` +
          `⏳ Waktu: 2 menit`,
          {
            parse_mode: "Markdown",
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

        // Timeout kick
        const timeout = setTimeout(async () => {
          if (captchaUsers.has(userId)) {
            try {
              await bot.banChatMember(chatId, userId);
              await bot.unbanChatMember(chatId, userId);

              await bot.sendMessage(
                chatId,
                `🚫 *${user.first_name}* gagal verifikasi.`,
                { parse_mode: "Markdown" }
              );

              captchaUsers.delete(userId);
            } catch (e) {
              console.log("Kick error:", e.message);
            }
          }
        }, CAPTCHA_TIMEOUT);

        // Simpan data
        captchaUsers.set(userId, {
          chatId,
          msgId: sent.message_id,
          timeout
        });

        console.log("Captcha dikirim:", userId);

      } catch (err) {
        console.log("Join error:", err.message);
      }
    }
  }
});


/* =========================
   SAAT CAPTCHA DIKLIK
========================= */
bot.on("callback_query", async (q) => {
  try {

    if (!q.data || !q.data.startsWith("captcha_")) return;

    const userId = Number(q.data.split("_")[1]);
    const clicker = q.from.id;

    // Cegah orang lain klik
    if (userId !== clicker) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Ini bukan captcha kamu!",
        show_alert: true
      });
    }

    const data = captchaUsers.get(userId);

    if (!data) {
      return bot.answerCallbackQuery(q.id, {
        text: "⚠️ Captcha expired!",
        show_alert: true
      });
    }

    const { chatId, msgId, timeout } = data;

    clearTimeout(timeout);

    // UNMUTE (FORMAT BENAR)
    await bot.restrictChatMember(chatId, userId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
      can_pin_messages: false
    });

    // Data user
    const name =
      `${q.from.first_name || ""} ${q.from.last_name || ""}`.trim();

    const username = q.from.username
      ? "@" + q.from.username
      : "Tidak ada";

    const id = q.from.id;

    // Welcome
    await bot.sendMessage(
      chatId,
      `🎉 *VERIFIKASI BERHASIL!*\n\n` +
      `👤 Nama: ${name}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 ID: ${id}\n\n` +
      `✅ Selamat datang 😊`,
      { parse_mode: "Markdown" }
    );

    // Hapus captcha
    await bot.deleteMessage(chatId, msgId).catch(() => {});
    captchaUsers.delete(userId);

    await bot.answerCallbackQuery(q.id, {
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

process.on("unhandledRejection", (e) => {
  console.log("Unhandled:", e.message);
});
