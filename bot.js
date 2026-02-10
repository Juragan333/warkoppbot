const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log("TOKEN belum diset!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot Anti No Username + Captcha Aktif...");

// Simpan user yang lagi captcha
const captchaUsers = new Map();

// Ketika member baru masuk
bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {

    const userId = user.id;

    // Cek username
    if (!user.username) {

      // Mute dulu
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

      // Simpan data captcha
      captchaUsers.set(userId, chatId);

      // Kirim captcha
      bot.sendMessage(chatId,
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
    }
  }
});

// Saat tombol captcha diklik
bot.on("callback_query", async (query) => {

  const data = query.data;

  if (!data.startsWith("captcha_")) return;

  const userId = parseInt(data.split("_")[1]);
  const clickerId = query.from.id;

  // Pastikan yang klik adalah usernya
  if (userId !== clickerId) {
    return bot.answerCallbackQuery(query.id, {
      text: "❌ Ini bukan captcha kamu!",
      show_alert: true
    });
  }

  const chatId = captchaUsers.get(userId);

  if (!chatId) {
    return bot.answerCallbackQuery(query.id, {
      text: "❌ Data captcha tidak ditemukan!",
      show_alert: true
    });
  }

  // Buka mute
  await bot.restrictChatMember(chatId, userId, {
    can_send_messages: true,
    can_send_media_messages: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: false,
    can_invite_users: true,
    can_pin_messages: false
  });

  // Ambil data user
  const firstName = query.from.first_name || "-";
  const lastName = query.from.last_name || "";
  const username = query.from.username
    ? "@" + query.from.username
    : "Tidak ada";
  const id = query.from.id;

  // Kirim welcome
  bot.sendMessage(chatId,
    `🎉 *Verifikasi Berhasil!*\n\n` +
    `👤 Nama: ${firstName} ${lastName}\n` +
    `🔗 Username: ${username}\n` +
    `🆔 ID: ${id}\n\n` +
    `✅ Selamat datang di grup!\n` +
    `Silakan chat dengan sopan ya 😊`,
    {
      parse_mode: "Markdown"
    }
  );

  // Hapus data captcha
  captchaUsers.delete(userId);

  // Hapus pesan captcha
  bot.deleteMessage(chatId, query.message.message_id).catch(() => {});

  bot.answerCallbackQuery(query.id, {
    text: "✅ Verifikasi sukses!"
  });
});

// Error handler
bot.on("polling_error", (err) => {
  console.log("Polling error:", err.message);
});
