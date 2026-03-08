import { createHmac } from 'crypto';

/**
 * Проверяет initData от Telegram WebApp.
 * Возвращает объект user или null если подпись невалидна / устарела.
 */
export function validateInitData(initDataStr) {
  if (!initDataStr) return null;

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initDataStr);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');

    if (hash !== expected) return null;

    // Данные не старше 24 часов
    const authDate = parseInt(params.get('auth_date') || '0');
    if (Date.now() / 1000 - authDate > 86400) return null;

    const userStr = params.get('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

/**
 * Проверяет, является ли user мастером (по MASTER_TELEGRAM_ID из env).
 */
export function isMaster(user) {
  if (!user) return false;
  return String(user.id) === process.env.MASTER_TELEGRAM_ID;
}

/**
 * Хелпер для мастер-эндпоинтов.
 * Проверяет initData и права мастера. При ошибке пишет в res и возвращает null.
 */
export function requireMaster(req, res) {
  const initData = req.headers['x-telegram-init-data'] || '';
  const user = validateInitData(initData);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing initData' });
    return null;
  }
  if (!isMaster(user)) {
    res.status(403).json({ error: 'Forbidden: not a master' });
    return null;
  }

  return user;
}
