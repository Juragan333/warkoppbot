const TelegramBot = require("node-telegram-bot-api");

// ENV TOKEN
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("❌ TOKEN belum diset!");
  process.exit(1);
}

// Start bot
const bot = new TelegramBot(TOKEN, {
  polling: {
    autoStart: true,
    params: {
      timeout: 60
    }
  }
});

console.log("🤖 Bot Captcha + Anti No Username Aktif...");

// userId => { chatId, msgId, timeout }
const captchaUsers = new Map();

// 2 menit
const CAPTCHA_TIMEOUT = 2 * 60 * 1000;

/* =========================
   DETEKSI MEMBER BARU
========================= */
bot.on("chat_member", async (msg) => {
  try {
    const chatId = msg.chat.id;

    const oldStatus = msg.old_chat_member.status;
    const newStatus = msg.new_chat_member.status;

    // Kalau user baru join
    if (
      oldStatus === "left" &&
      (newStatus === "member" || newStatus === "restricted")
    ) {
      const user = msg.new_chat_member.user;
      const userId = user.id;

      // Kalau ada username → skip
      if (user.username) return;

      console.log("User join:", userId);

      // Mute
      await bot.restrictChatMember(chatId, userId, {
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        }
      });

      // Kirim captcha
      const sent = await bot.sendMessage(
        chatId,
        `👋 Halo *${user.first_name}*\n\n` +
        `Klik tombol untuk verifikasi 👇\n` +
        `⏳ 2 menit`,
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

      // Simpan
      captchaUsers.set(userId, {
        chatId,
        msgId: sent.message_id,
        timeout
      });

      console.log("Captcha dikirim:", userId);
    }

  } catch (err) {
    console.log("Join error:", err.message);
  }
});


/* =========================
   CAPTCHA CLICK
========================= */
bot.on("callback_query", async (q) => {
  try {
    if (!q.data || !q.data.startsWith("captcha_")) return;

    const userId = parseInt(q.data.split("_")[1]);
    const clicker = q.from.id;

    if (userId !== clicker) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Bukan captcha kamu!",
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

    // Unmute
    await bot.restrictChatMember(chatId, userId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      }
    });

    const name =
      (q.from.first_name || "") +
      " " +
      (q.from.last_name || "");

    const username = q.from.username
      ? "@" + q.from.username
      : "Tidak ada";

    // Welcome
    await bot.sendMessage(
      chatId,
      `🎉 *VERIFIKASI BERHASIL!*\n\n` +
      `👤 ${name.trim()}\n` +
      `🔗 ${username}\n` +
      `🆔 ${q.from.id}\n\n` +
      `✅ Selamat datang!`,
      { parse_mode: "Markdown" }
    );

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
   ERROR
========================= */
bot.on("polling_error", (e) => {
  console.log("Polling:", e.message);
});

process.on("unhandledRejection", (e) => {
  console.log("Unhandled:", e);
});
