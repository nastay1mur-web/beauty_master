import { db, cors } from '../_supabase.js';
import { requireMaster } from '../_auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!requireMaster(req, res)) return;

    // GET /api/master/bookings?date=YYYY-MM-DD&status=confirmed
    if (req.method === 'GET') {
      const { date, status } = req.query;

      let query = 'bookings?order=booking_date.asc,start_time.asc&select=*';
      if (date)   query += `&booking_date=eq.${date}`;
      if (status) query += `&status=eq.${status}`;

      const bookings = await db(query);
      return res.status(200).json(bookings || []);
    }

    // PATCH /api/master/bookings?id=xxx  { status: 'done'|'cancelled'|'no_show', cancel_reason? }
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { status, cancel_reason } = req.body || {};

      const allowed = ['done', 'cancelled', 'no_show', 'confirmed'];
      if (!id || !allowed.includes(status)) {
        return res.status(400).json({ error: 'Укажите id и допустимый status' });
      }

      const body = { status, updated_at: new Date().toISOString() };
      if (status === 'cancelled') {
        body.cancelled_by = 'master';
        if (cancel_reason) body.cancel_reason = cancel_reason;
      }

      await db(`bookings?id=eq.${id}`, { method: 'PATCH', body });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
