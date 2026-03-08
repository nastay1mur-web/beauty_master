import { cors } from '../_supabase.js';
import { validateInitData, isMaster } from '../_auth.js';

export default function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const initData = req.headers['x-telegram-init-data'] || '';
  const user = validateInitData(initData);

  res.status(200).json({ isMaster: isMaster(user) });
}
