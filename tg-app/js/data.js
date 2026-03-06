/**
 * data.js — Данные каталога
 *
 * Здесь хранится вся контентная часть приложения:
 *   - Информация о мастере
 *   - Категории услуг
 *   - Каталог услуг с ценами и описаниями
 *   - Логика генерации расписания
 *
 * Чтобы изменить данные мастера или услуги — редактируйте этот файл.
 */

'use strict';

// ── МАСТЕР ──────────────────────────────────────────────────────────────────

const MASTER = {
  name: 'Катя',
  fullName: 'Екатерина Соколова',
  title: 'Мастер маникюра и педикюра',
  rating: 4.9,
  reviewCount: 247,
  experience: 6,                         // лет опыта
  bio: 'Привет! Меня зовут Катя, занимаюсь ногтевым сервисом уже 6 лет. Специализация — гель-лак, наращивание и аккуратный педикюр. Работаю с материалами CND, OPI и Kodi Professional. Жду вас в уютной домашней студии — кофе и хорошее настроение включены!',
  address: 'ул. Садовая, 15, кв. 8',
  city: 'Москва',
  // Ссылка на Яндекс Карты — замените на реальный адрес
  mapUrl: 'https://yandex.ru/maps/?text=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C+%D1%83%D0%BB.+%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F%2C+15',
  hours: [
    { days: 'Пн–Пт', time: '10:00 – 20:00' },
    { days: 'Суббота', time: '10:00 – 18:00' },
    { days: 'Воскресенье', time: 'Выходной' },
  ],
  // Username мастера для кнопки «Написать» (без @)
  telegramUsername: 'katya_nails_msk',
  // Username бота для оффера и записи (без @)
  botUsername: 'Pedicure_Manicure_bot',
  cancellationPolicy: 'Отмена бесплатно за 24 часа до визита',
};

// ── КАТЕГОРИИ ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'all',      name: 'Все',      emoji: '✨' },
  { id: 'manicure', name: 'Маникюр', emoji: '💅' },
  { id: 'pedicure', name: 'Педикюр', emoji: '🦶' },
  { id: 'lashes',   name: 'Лэши',    emoji: '👁' },
  { id: 'brows',    name: 'Брови',   emoji: '🌿' },
];

// ── УСЛУГИ ──────────────────────────────────────────────────────────────────
//
// gradient — CSS-градиент для обложки карточки
// emoji    — иконка поверх градиента
// available — false скрывает кнопку «Записаться»

const SERVICES = [
  // ── МАНИКЮР ──────────────────────────────────────────────
  {
    id: 'manicure-gel',
    categoryId: 'manicure',
    name: 'Маникюр с гель-лаком',
    shortDesc: 'Держится 3–4 недели без сколов',
    description: 'Профессиональное покрытие гелем с полной подготовкой ногтей. Включает снятие старого покрытия, опил, придание формы, обработку кутикулы, нанесение базы и цветного гель-лака. Палитра — более 200 оттенков. Простой дизайн на выбор входит в стоимость.',
    duration: 90,
    price: 1800,
    priceNote: 'Простой дизайн включён',
    gradient: 'linear-gradient(135deg, #FFD6E0 0%, #FF9BBD 100%)',
    emoji: '💅',
    available: true,
    bookingCount: 312,
    photos: 3,
  },
  {
    id: 'manicure-classic',
    categoryId: 'manicure',
    name: 'Маникюр классический',
    shortDesc: 'Уход за ногтями без покрытия',
    description: 'Классический маникюр с обработкой кутикулы, опилом и приданием формы. Наносится база или бесцветный лак. Подходит для регулярного ухода или как основа перед наращиванием. Кожа рук увлажняется специальным кремом.',
    duration: 60,
    price: 1200,
    priceNote: 'Цветной лак +300 ₽',
    gradient: 'linear-gradient(135deg, #FFE8F0 0%, #FFC0D8 100%)',
    emoji: '✨',
    available: true,
    bookingCount: 187,
    photos: 2,
  },
  {
    id: 'manicure-extension',
    categoryId: 'manicure',
    name: 'Наращивание ногтей',
    shortDesc: 'Гель, любая форма и длина',
    description: 'Наращивание на типсы или форму с помощью геля. Формы: квадрат, миндаль, стилет, балерина, овал. Дизайн на выбор включён в стоимость. Коррекция рекомендуется через 3–4 недели. Результат держится 6–8 недель.',
    duration: 150,
    price: 3500,
    priceNote: 'Дизайн включён',
    gradient: 'linear-gradient(135deg, #FFDDE8 0%, #FFB0CC 100%)',
    emoji: '💎',
    available: true,
    bookingCount: 89,
    photos: 3,
  },

  // ── ПЕДИКЮР ──────────────────────────────────────────────
  {
    id: 'pedicure-classic',
    categoryId: 'pedicure',
    name: 'Педикюр классический',
    shortDesc: 'Полная обработка стоп',
    description: 'Аппаратный педикюр с обработкой пяток, уходом за кутикулой, опилом и приданием формы ногтям. Включает питательный крем и расслабляющий массаж стоп. Завершается нанесением базового покрытия. Кожа становится мягкой и ухоженной.',
    duration: 90,
    price: 2000,
    priceNote: 'Базовое покрытие включено',
    gradient: 'linear-gradient(135deg, #FFE8D1 0%, #FFBE8A 100%)',
    emoji: '🦶',
    available: true,
    bookingCount: 156,
    photos: 2,
  },
  {
    id: 'pedicure-gel',
    categoryId: 'pedicure',
    name: 'Педикюр с гель-лаком',
    shortDesc: 'Стопы + стойкое покрытие 3 недели',
    description: 'Полный аппаратный педикюр с нанесением гель-лака. Обработка пяток, кутикулы, опил и форма ногтей — всё включено. Держится 3–4 недели. Более 200 оттенков на выбор. Ноги будут выглядеть идеально даже летом в открытой обуви.',
    duration: 120,
    price: 2500,
    priceNote: 'Дизайн от 300 ₽',
    gradient: 'linear-gradient(135deg, #FFECD8 0%, #FFD0A0 100%)',
    emoji: '🌸',
    available: true,
    bookingCount: 203,
    photos: 3,
  },

  // ── ЛЭШИ ─────────────────────────────────────────────────
  {
    id: 'lashes-classic',
    categoryId: 'lashes',
    name: 'Наращивание ресниц',
    shortDesc: 'Классика, 2D или объём',
    description: 'Наращивание ресниц шёлком. Объём на выбор: классика (1:1) — натуральный эффект, лёгкий объём 2D — пушистые ресницы, смешанная техника — для особого случая. Держится 3–4 недели. Коррекция рекомендуется через 2–3 недели.',
    duration: 120,
    price: 3000,
    priceNote: '2D и 3D +500 ₽',
    gradient: 'linear-gradient(135deg, #E0D6F5 0%, #B8A4EF 100%)',
    emoji: '👁',
    available: true,
    bookingCount: 134,
    photos: 3,
  },
  {
    id: 'lashes-lamination',
    categoryId: 'lashes',
    name: 'Ламинирование ресниц',
    shortDesc: 'Подъём и укрепление без наращивания',
    description: 'Ламинирование придаёт ресницам красивый изгиб и объём без наращивания. Ресницы выглядят более густыми и длинными. Питательный состав укрепляет их структуру. Эффект держится 4–6 недель. Можно добавить окрашивание.',
    duration: 90,
    price: 2200,
    priceNote: 'Окрашивание +500 ₽',
    gradient: 'linear-gradient(135deg, #EDE0FA 0%, #CCAAEF 100%)',
    emoji: '💜',
    available: true,
    bookingCount: 78,
    photos: 2,
  },

  // ── БРОВИ ─────────────────────────────────────────────────
  {
    id: 'brows-correction',
    categoryId: 'brows',
    name: 'Коррекция бровей',
    shortDesc: 'Форма воском и пинцетом',
    description: 'Коррекция формы бровей воском и пинцетом с учётом особенностей лица. Форма подбирается индивидуально. Обработка кожи до и после процедуры успокаивающим лосьоном. Результат — аккуратные, выразительные брови.',
    duration: 45,
    price: 800,
    priceNote: null,
    gradient: 'linear-gradient(135deg, #E8DACC 0%, #C8AA88 100%)',
    emoji: '🌿',
    available: true,
    bookingCount: 265,
    photos: 2,
  },
  {
    id: 'brows-coloring',
    categoryId: 'brows',
    name: 'Окрашивание бровей',
    shortDesc: 'Хна или краска, эффект до 6 недель',
    description: 'Окрашивание бровей стойкими профессиональными красителями или хной. Придаёт бровям насыщенный цвет и видимую густоту. Хна дополнительно окрашивает кожу — эффект держится 2 недели на коже и до 6 недель на волосах.',
    duration: 45,
    price: 600,
    priceNote: 'Хна +200 ₽',
    gradient: 'linear-gradient(135deg, #EDE0D4 0%, #D0B898 100%)',
    emoji: '✏️',
    available: true,
    bookingCount: 198,
    photos: 2,
  },
];

// ── РАСПИСАНИЕ ───────────────────────────────────────────────────────────────

/**
 * Генерирует доступные слоты на следующие 30 дней.
 * Часть слотов помечается как занятые — чтобы выглядело реалистично.
 * В реальном проекте данные приходят с сервера.
 *
 * @returns {Object} { 'YYYY-MM-DD': [{ time: 'HH:MM', busy: bool }] }
 */
function generateSlots() {
  const slots = {};
  const today = new Date();

  // Индексы «занятых» слотов — псевдо-случайный паттерн
  const busyMod = [2, 5, 9, 14, 17, 22, 26];

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const dayOfWeek = date.getDay(); // 0=вс, 6=сб
    if (dayOfWeek === 0) continue;  // Воскресенье — выходной

    const dateKey = date.toISOString().split('T')[0];

    // Суббота — укороченный день
    const times = dayOfWeek === 6
      ? ['10:00', '11:30', '13:00', '14:30', '16:00']
      : ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00'];

    slots[dateKey] = times.map((time, idx) => ({
      time,
      busy: busyMod.some(m => (i * 7 + idx) % 31 === m),
    }));
  }

  return slots;
}

// ── ФОРМАТИРОВАНИЕ ───────────────────────────────────────────────────────────

const DAYS_LONG  = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS     = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** 'Среда, 19 марта' */
function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** 'ср, 19 мар' */
function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '—';
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** 'Вт' + '18' для плашки выбора дня */
function formatDayPill(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    dayName: DAYS_SHORT[d.getDay()].toUpperCase(),
    dayNum: d.getDate(),
  };
}

/**
 * Считает время окончания процедуры
 * @param {string} startTime  'HH:MM'
 * @param {number} duration   минуты
 * @returns {string}          'HH:MM'
 */
function calcEndTime(startTime, duration) {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + duration;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Форматирует цену: 1800 → '1 800 ₽' */
function formatPrice(price) {
  return price.toLocaleString('ru-RU') + ' ₽';
}

/** Форматирует длительность: 90 → '1 ч 30 мин', 60 → '1 ч', 45 → '45 мин' */
function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}
