const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("TOKEN belum diset!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

console.log("🤖 Bot Anti No Username + Captcha Aktif...");

// Simpan user yang belum verifikasi
const pending = new Map();

// Tangkap join
bot.on("message", async (msg) => {

  if (!msg.new_chat_members) return;

  const chatId = msg.chat.id;

  for (const user of msg.new_chat_members) {

    // Tanpa username = BAN
    if (!user.username) {
      await bot.banChatMember(chatId, user.id);
      continue;
    }

    // Mute dulu
    await bot.restrictChatMember(chatId, user.id, {
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
    const sent = await bot.sendMessage(chatId,
      `👋 Halo ${user.first_name}\nKlik tombol di bawah untuk verifikasi (60 detik)`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Saya Manusia", callback_data: "verify_" + user.id }]
          ]
        }
      }
    );

    pending.set(user.id, {
      chatId,
      msgId: sent.message_id
    });

    // Timeout 60 detik
    setTimeout(async () => {

      if (!pending.has(user.id)) return;

      try {
        await bot.banChatMember(chatId, user.id);
        pending.delete(user.id);
      } catch (e) {}

    }, 60000);
  }
});

// Handle klik tombol
bot.on("callback_query", async (q) => {

  if (!q.data.startsWith("verify_")) return;

  const userId = Number(q.data.split("_")[1]);

  if (q.from.id !== userId) {
    return bot.answerCallbackQuery(q.id, {
      text: "Ini bukan captcha kamu ❌",
      show_alert: true
    });
  }

  const data = pending.get(userId);

  if (!data) return;

  try {
    // Unmute
    await bot.restrictChatMember(data.chatId, userId, {
      permissions: {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_invite_users: true,
        can_change_info: false,
        can_pin_messages: false
      }
    });

    // Hapus captcha
    await bot.deleteMessage(data.chatId, data.msgId);

    pending.delete(userId);

    await bot.answerCallbackQuery(q.id, {
      text: "✅ Verifikasi berhasil!"
    });

  } catch (err) {
    console.error(err.message);
  }
});
