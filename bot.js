const TelegramBot = require("node-telegram-bot-api");
const http = require("http");

// Ambil token dari ENV (Railway)
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("❌ TOKEN belum diset!");
  process.exit(1);
}

// Start bot
const bot = new TelegramBot(TOKEN, {
  polling: {
    interval: 1000,
    autoStart: true
  }
});

console.log("🤖 Bot Captcha Aktif...");

// Simpan user captcha
// userId => { chatId, msgId, timeout }
const captchaUsers = new Map();

// Timeout 2 menit
const CAPTCHA_TIMEOUT = 2 * 60 * 1000;


/* =========================
   DETEK MEMBER MASUK
========================= */
bot.on("message", async (msg) => {

  // Kalau bukan join member → skip
  if (!msg.new_chat_members) return;

  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {

    const userId = user.id;

    // Kalau ada username → skip
    if (user.username) continue;

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
        `Klik tombol di bawah untuk verifikasi\n` +
        `⏳ Waktu 2 menit`,
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

        if (!captchaUsers.has(userId)) return;

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
        text: "❌ Bukan captcha kamu!",
        show_alert: true
      });
    }

    const userData = captchaUsers.get(userId);

    if (!userData) {
      return bot.answerCallbackQuery(query.id, {
        text: "⚠️ Captcha expired!",
        show_alert: true
      });
    }

    const { chatId, msgId, timeout } = userData;

    clearTimeout(timeout);

    // Unmute
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
    await bot.sendMessage(
      chatId,
      `🎉 *VERIFIKASI BERHASIL!*\n\n` +
      `👤 Nama: ${name}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 ID: ${id}\n\n` +
      `✅ Selamat datang!`,
      { parse_mode: "Markdown" }
    );

    // Hapus tombol
    await bot.deleteMessage(chatId, msgId).catch(() => {});

    captchaUsers.delete(userId);

    await bot.answerCallbackQuery(query.id, {
      text: "✅ Berhasil!"
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


/* =========================
   KEEP ALIVE SERVER
   (ANTI MATI DI RAILWAY)
========================= */
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is running 🚀");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Web server running on port", PORT);
});
