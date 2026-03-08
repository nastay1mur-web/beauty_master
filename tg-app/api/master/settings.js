import { db, cors } from '../_supabase.js';
import { requireMaster } from '../_auth.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!requireMaster(req, res)) return;

    // GET — настройки профиля мастера
    if (req.method === 'GET') {
      const rows = await db('master_settings?select=*&limit=1');
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Настройки не найдены' });
      return res.status(200).json(rows[0]);
    }

    // PATCH — обновить настройки
    if (req.method === 'PATCH') {
      const rows = await db('master_settings?select=id&limit=1');
      const id = rows?.[0]?.id;
      if (!id) return res.status(404).json({ error: 'Настройки не найдены' });

      const body = { ...req.body, updated_at: new Date().toISOString() };
      delete body.id;
      delete body.created_at;

      const result = await db(`master_settings?id=eq.${id}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body,
      });
      return res.status(200).json(result[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
