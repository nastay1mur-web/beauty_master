import { db, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/bookings?telegram_user_id=123
  if (req.method === 'GET') {
    const { telegram_user_id } = req.query;
    if (!telegram_user_id) {
      return res.status(400).json({ error: 'telegram_user_id обязателен' });
    }
    try {
      const bookings = await db(
        `bookings?telegram_user_id=eq.${telegram_user_id}&order=booking_date.desc,start_time.desc&select=*`
      );
      res.status(200).json(bookings || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // POST /api/bookings — создать запись
  if (req.method === 'POST') {
    const {
      telegram_user_id, telegram_first_name, telegram_last_name, telegram_username,
      service_id, service_name, service_price, service_duration,
      booking_date, start_time, end_time,
    } = req.body || {};

    if (!telegram_user_id || !service_id || !booking_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Не заполнены обязательные поля' });
    }

    try {
      // Проверяем что слот ещё свободен (защита от гонки)
      const existing = await db(
        `bookings?booking_date=eq.${booking_date}&status=eq.confirmed&select=start_time,end_time`
      );

      const newStart = toMin(start_time);
      const newEnd   = toMin(end_time);

      const conflict = (existing || []).some(b => {
        const s = toMin(b.start_time);
        const e = toMin(b.end_time);
        return newStart < e && newEnd > s;
      });

      if (conflict) {
        return res.status(409).json({ error: 'Этот слот уже занят, выберите другое время' });
      }

      // Сохраняем запись
      const result = await db('bookings', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          telegram_user_id, telegram_first_name,
          telegram_last_name: telegram_last_name || null,
          telegram_username:  telegram_username  || null,
          service_id, service_name, service_price, service_duration,
          booking_date, start_time, end_time,
          status: 'confirmed',
        },
      });

      res.status(201).json(result[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // PATCH /api/bookings?id=xxx&action=cancel — отменить запись
  if (req.method === 'PATCH') {
    const { id, action } = req.query;
    if (!id || action !== 'cancel') {
      return res.status(400).json({ error: 'Укажите id и action=cancel' });
    }
    try {
      await db(`bookings?id=eq.${id}`, {
        method: 'PATCH',
        body: { status: 'cancelled', cancelled_by: 'client' },
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

function toMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
