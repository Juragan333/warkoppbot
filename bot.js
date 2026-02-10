const TelegramBot = require('node-telegram-bot-api');

// Ambil token dari Railway ENV
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("TOKEN belum diset!");
  process.exit(1);
}

// Jalankan bot
const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot Anti No Username Aktif...");

// Saat member baru masuk grup
bot.on('new_chat_members', async (msg) => {
  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {

    // Jika TIDAK punya username → BAN
    if (!user.username) {
      try {
        await bot.banChatMember(chatId, user.id);

        await bot.sendMessage(
          chatId,
          "🚫 Akun tanpa username tidak diizinkan masuk grup."
        );

        console.log(`Blocked: ${user.first_name}`);

      } catch (err) {
        console.error("Error:", err.message);
      }
    }
  }
});
