import { db, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const services = await db(
      'services?select=*,service_photos(id,storage_path,sort_order)&order=sort_order'
    );

    const SUPABASE_URL = process.env.SUPABASE_URL;

    const result = services.map(s => ({
      ...s,
      // Формируем публичные URL для фото
      photoUrls: (s.service_photos || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(p => `${SUPABASE_URL}/storage/v1/object/public/beauty-catalog/${p.storage_path}`),
      // Количество фото для карусели (если фото ещё нет — используем emoji-заглушку)
      photos: Math.max((s.service_photos || []).length, 1),
    }));

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
