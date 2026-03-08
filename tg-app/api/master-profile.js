import { db, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rows = await db('master_settings?select=*&limit=1');
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const master = rows[0];
    const SUPABASE_URL = process.env.SUPABASE_URL;

    // Формируем публичный URL фото мастера если есть
    if (master.photo_path) {
      master.photoUrl = `${SUPABASE_URL}/storage/v1/object/public/beauty-catalog/${master.photo_path}`;
    }

    res.status(200).json(master);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
