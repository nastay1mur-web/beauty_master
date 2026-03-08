import { db, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const categories = await db('categories?select=*&order=sort_order');
    res.status(200).json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
