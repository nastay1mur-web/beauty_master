import { db, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { date, service_id } = req.query;
  if (!date || !service_id) {
    return res.status(400).json({ error: 'Параметры date и service_id обязательны' });
  }

  try {
    // 1. Длительность услуги
    const services = await db(`services?id=eq.${service_id}&select=duration&limit=1`);
    if (!services || services.length === 0) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    const duration = services[0].duration;

    // 2. График на эту дату:
    //    сначала ищем конкретную дату, потом — шаблон по дню недели
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();

    const overrides = await db(`work_schedule?specific_date=eq.${date}&select=*&limit=1`);
    let schedule = overrides && overrides[0];

    if (!schedule) {
      const weekly = await db(
        `work_schedule?day_of_week=eq.${dayOfWeek}&specific_date=is.null&select=*&limit=1`
      );
      schedule = weekly && weekly[0];
    }

    // Выходной или нет расписания
    if (!schedule || !schedule.is_working) {
      return res.status(200).json([]);
    }

    // 3. Занятые блоки из подтверждённых записей
    const bookings = await db(
      `bookings?booking_date=eq.${date}&status=eq.confirmed&select=start_time,end_time`
    );

    const occupied = (bookings || []).map(b => ({
      start: toMin(b.start_time),
      end:   toMin(b.end_time),
    }));

    // Добавляем перерыв как занятый блок
    if (schedule.break_start && schedule.break_end) {
      occupied.push({
        start: toMin(schedule.break_start),
        end:   toMin(schedule.break_end),
      });
    }

    // 4. Генерируем кандидатов каждые 30 минут
    const workStart = toMin(schedule.start_time);
    const workEnd   = toMin(schedule.end_time);
    const slots = [];

    for (let t = workStart; t + duration <= workEnd; t += 30) {
      const slotEnd = t + duration;
      // Проверяем пересечение с занятыми блоками
      const free = !occupied.some(o => t < o.end && slotEnd > o.start);
      if (free) slots.push(toTime(t));
    }

    res.status(200).json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function toMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}
