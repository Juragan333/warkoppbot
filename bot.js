const TelegramBot = require("node-telegram-bot-api");

// Ambil token dari Railway / ENV
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("❌ TOKEN belum diset!");
  process.exit(1);
}

// Jalankan bot
const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot Captcha + Anti No Username Aktif...");

// Simpan user captcha
// userId => { chatId, msgId, timeout }
const captchaUsers = new Map();

// Durasi captcha (2 menit)
const CAPTCHA_TIMEOUT = 2 * 60 * 1000;

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
        // Mute user
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

        // Kirim captcha
        const sent = await bot.sendMessage(
          chatId,
          `👋 Halo *${user.first_name}*\n\n` +
          `Silakan klik tombol di bawah untuk verifikasi 👇\n` +
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

        // Auto kick kalau timeout
        const timeout = setTimeout(async () => {
          if (captchaUsers.has(userId)) {
            try {
              await bot.banChatMember(chatId, userId);
              await bot.unbanChatMember(chatId, userId);

              await bot.sendMessage(
                chatId,
                `🚫 User *${user.first_name}* gagal verifikasi dan dikeluarkan.`,
                { parse_mode: "Markdown" }
              );

              captchaUsers.delete(userId);
            } catch (e) {
              console.log("Kick error:", e.message);
            }
          }
        }, CAPTCHA_TIMEOUT);

        // Simpan data captcha
        captchaUsers.set(userId, {
          chatId,
          msgId: sent.message_id,
          timeout
        });

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

    if (!data || !data.startsWith("captcha_")) return;

    const userId = parseInt(data.split("_")[1]);
    const clicker = query.from.id;

    // Cegah orang lain klik
    if (userId !== clicker) {
      return bot.answerCallbackQuery(query.id, {
        text: "❌ Ini bukan captcha kamu!",
        show_alert: true
      });
    }

    const dataUser = captchaUsers.get(userId);

    if (!dataUser) {
      return bot.answerCallbackQuery(query.id, {
        text: "⚠️ Captcha sudah expired!",
        show_alert: true
      });
    }

    const { chatId, msgId, timeout } = dataUser;

    // Hapus timeout kick
    clearTimeout(timeout);

    // Unmute user
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

    // Welcome message
    await bot.sendMessage(
      chatId,
      `🎉 *VERIFIKASI BERHASIL!*\n\n` +
      `👤 Nama: ${name}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 ID: ${id}\n\n` +
      `✅ Selamat datang di grup!\n` +
      `💬 Silakan ngobrol dengan sopan 😊`,
      { parse_mode: "Markdown" }
    );

    // Hapus pesan captcha
    await bot.deleteMessage(chatId, msgId).catch(() => {});

    // Hapus data
    captchaUsers.delete(userId);

    // Jawab tombol
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

process.on("unhandledRejection", (err) => {
  console.log("Unhandled:", err.message);
});
