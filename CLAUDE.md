# CLAUDE.md — Beauty Catalog TMA

Telegram Mini App каталога услуг бьюти-мастера.
Стек: Vanilla HTML + CSS + JavaScript, без фреймворков.

---

## Структура файлов

```
tg-beauty-catalog/
├── CLAUDE.md              ← этот файл
├── research.md            ← исследование рынка и UX-анализ
├── brief.md               ← детальный бриф: 7 экранов, элементы, копирайт
│
└── tg-app/                ← ВСЕ ФАЙЛЫ ПРИЛОЖЕНИЯ
    ├── index.html         ← точка входа, HTML-оболочка
    ├── css/
    │   └── styles.css     ← все стили (BEM-like, CSS Variables)
    └── js/
        ├── data.js        ← контент: мастер, категории, услуги, расписание
        └── app.js         ← вся логика: роутер, экраны, Telegram API
```

---

## Где менять данные

### Изменить информацию о мастере
Файл: [tg-app/js/data.js](tg-app/js/data.js), объект `MASTER` (строка ~9)

```js
const MASTER = {
  name: 'Катя',                // Короткое имя (в шапке)
  fullName: 'Екатерина...',    // Полное имя (экран «О мастере»)
  rating: 4.9,                 // Рейтинг (число)
  bio: '...',                  // Текст «О себе»
  address: 'ул. Садовая...',   // Адрес
  mapUrl: 'https://...',       // Ссылка на Яндекс Карты
  telegramUsername: 'katya_nails_msk', // без @
  cancellationPolicy: '...',   // Политика отмены (видна на Э2 и Э4)
};
```

### Добавить или изменить услугу
Файл: [tg-app/js/data.js](tg-app/js/data.js), массив `SERVICES` (строка ~65)

Каждая услуга:
```js
{
  id: 'уникальный-id',
  categoryId: 'manicure',    // должна совпадать с id в CATEGORIES
  name: 'Название',
  shortDesc: 'Краткое описание',
  description: 'Полное описание для Э2',
  duration: 90,              // минуты
  price: 1800,               // рублей
  priceNote: 'Доп. текст',   // или null
  gradient: 'linear-gradient(135deg, ...)',  // фон карточки
  emoji: '💅',               // иконка на фоне
  available: true,           // false = кнопка «Нет свободных слотов»
  bookingCount: 312,         // счётчик записей (отображается на фото)
  photos: 3,                 // сколько слайдов в карусели
}
```

### Изменить категории
Файл: [tg-app/js/data.js](tg-app/js/data.js), массив `CATEGORIES` (строка ~55)

### Изменить расписание (доступные дни/время)
Файл: [tg-app/js/data.js](tg-app/js/data.js), функция `generateSlots()` (строка ~155)
- `times` — массив временных слотов по дням
- `dayOfWeek === 0` — воскресенье выходной (число 0–6)
- `busyMod` — паттерн «занятых» слотов (для реализма в demo)

В реальном проекте: замените `generateSlots()` на запрос к API.

---

## Навигация между экранами

```
[Э1: Каталог] ──────────────────────────────────────────
  Tab 1 (всегда доступен)
  тап на карточку / «Записаться» → [Э2: Детали]

[Э2: Детали услуги] ─────────────────────────────────────
  Воронка — нижний таб скрыт
  BackButton ← → [Э1]
  MainButton «Записаться» → [Э3: Дата]

[Э3: Выбор даты и времени] ──────────────────────────────
  BackButton ← → [Э2]
  Выбор дня → показываются слоты
  Выбор слота → MainButton активируется
  MainButton «Далее — ср, 19 мар, 14:30» → [Э4: Подтверждение]

[Э4: Подтверждение] ──────────────────────────────────────
  BackButton ← → [Э3] (данные сохранены)
  MainButton «Подтвердить запись» → 700ms задержка → [Э5: Успех]

[Э5: Успех] ──────────────────────────────────────────────
  BackButton скрыт
  MainButton скрыт
  Кнопка «Вернуться к услугам» → [Э1] (история сбрасывается)

[Э6: Мои записи] ─────────────────────────────────────────
  Tab 2 (всегда доступен)
  «Отменить» → TG.showConfirm() → обновляет статус
  «Записаться снова» → [Э3] с предвыбранной услугой

[Э7: О мастере] ──────────────────────────────────────────
  Tab 3 (всегда доступен)
  «Открыть карту» → TG.openLink(mapUrl)
  «Написать мастеру» → TG.openTelegramLink(username)
```

---

## Технический стек

| Файл | Ответственность |
|------|----------------|
| `index.html` | HTML-оболочка, подключение SDK и скриптов |
| `css/styles.css` | Все стили: переменные, компоненты, анимации |
| `js/data.js` | Контент: MASTER, CATEGORIES, SERVICES, generateSlots() |
| `js/app.js` | Логика: STATE, TG (Telegram API), роутер, рендер экранов |

---

## Ключевые объекты в app.js

### STATE — глобальное состояние
```js
STATE = {
  screen: 'catalog',    // текущий экран
  history: [],          // стек для BackButton
  category: 'all',      // фильтр в каталоге
  service: null,        // выбранная услуга
  booking: {
    service, date, time, endTime  // текущая запись
  },
  bookings: [],         // все записи (localStorage)
  slots: null,          // кэш расписания
}
```

### TG — обёртка Telegram Web App API
```js
TG.init()                          // WebApp.ready() + expand()
TG.getUserName()                   // из initDataUnsafe.user
TG.haptic.selection/impact/success/error()
TG.backBtn.show(callback) / hide()
TG.mainBtn.show(text, callback) / hide() / setLoading()
TG.confirm(message, callback)      // нативный попап
TG.openLink(url)
TG.openTelegramChat(username)
```

Все методы TG имеют fallback для браузера без Telegram.

---

## Цвета

Все цвета через CSS-переменные Telegram:
```css
var(--tg-bg)           /* фон */
var(--tg-text)         /* текст */
var(--tg-hint)         /* серый текст */
var(--tg-secondary)    /* фон карточек */
var(--tg-btn)          /* цвет кнопок (обычно #2AABEE) */
```

Единственный брендовый цвет:
```css
--accent: #C9A96E;     /* нежно-золотой — активный таб, выбранный слот */
```

Менять цвет акцента → `styles.css`, строка `--accent`.

---

## Записи

Записи сохраняются в `localStorage` (ключ `beauty_bookings`).
В реальном проекте заменить `saveBooking()` и `loadBookings()` в app.js
на запросы к backend API.

---

## Что делать дальше (v1.1)

- Подключить backend для слотов и записей
- Добавить онлайн-оплату через Telegram Payments (ЮКасса)
- Реализовать push-уведомления через бота (за 24ч до визита)
- Добавить систему отзывов (после 50+ записей)
- Реализовать автонапоминание о повторной записи
