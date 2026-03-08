import { db, cors } from '../_supabase.js';
import { requireMaster } from '../_auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!requireMaster(req, res)) return;

    // GET — весь график (шаблон + исключения)
    if (req.method === 'GET') {
      const schedule = await db(
        'work_schedule?order=day_of_week.asc.nullslast,specific_date.asc.nullslast&select=*'
      );
      return res.status(200).json(schedule || []);
    }

    // PATCH — обновить строку по id (еженедельный шаблон)
    if (req.method === 'PATCH') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id обязателен' });

      const body = { ...req.body, updated_at: new Date().toISOString() };
      delete body.id;

      await db(`work_schedule?id=eq.${id}`, { method: 'PATCH', body });
      return res.status(200).json({ ok: true });
    }

    // POST — добавить исключение для конкретной даты
    if (req.method === 'POST') {
      const row = req.body;
      if (!row || !row.specific_date) {
        return res.status(400).json({ error: 'specific_date обязателен' });
      }

      const result = await db('work_schedule', {
        method: 'POST',
        prefer: 'return=representation',
        body: row,
      });
      return res.status(201).json(result[0]);
    }

    // DELETE — удалить исключение для конкретной даты
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id обязателен' });

      await db(`work_schedule?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
