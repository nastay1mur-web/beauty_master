const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = 'https://beauty-catalog-omega.vercel.app';

async function sendMessage(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: 'HTML', ...options };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const update = req.body;
  const message = update?.message;
  if (!message) return res.status(200).send('OK');

  const chatId = message.chat.id;
  const firstName = message.from?.first_name || 'красавица';
  const text = message.text || '';

  if (text.startsWith('/start')) {
    await sendMessage(
      chatId,
      `Привет, ${firstName}! 👋\n\nЯ помогу тебе записаться к мастеру красоты 💅\n\nВыбирай услугу, удобное время — всё онлайн, без звонков и ожиданий.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '💅 Перейти в каталог', web_app: { url: APP_URL } }
          ]]
        }
      }
    );
  } else if (text.startsWith('/help')) {
    await sendMessage(
      chatId,
      `Что умеет этот бот:\n\n• Показывает все услуги мастера с ценами\n• Позволяет записаться онлайн\n• Хранит твои записи\n\nНапиши /start чтобы открыть каталог.`
    );
  }

  res.status(200).send('OK');
}
