# BACKEND-PLAN.md — Beauty Catalog

> Архитектурный план backend под ключ.
> Составлен на основе: кода приложения, research.md, brief.md, ответов мастера.

---

## 0. Контекст и принятые решения

| Вопрос | Решение |
|---|---|
| Авторизация мастера | Telegram ID в env-переменной `MASTER_TELEGRAM_ID` |
| Загрузка фото | input type=file в Mini App → Supabase Storage |
| Параллельность услуг | Строго линейно: одна процедура → следующая |
| График | Мастер настраивает сам: дни недели + конкретные даты + время + перерыв |
| Уведомления | Только в панели мастера в Mini App |
| База данных | Supabase (PostgreSQL + Storage) |
| Хостинг API | Vercel Serverless Functions (уже используется) |

---

## 1. База данных — таблицы

### 1.1 `categories` — категории услуг

```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name        text NOT NULL              -- 'Маникюр'
emoji       text NOT NULL              -- '💅'
sort_order  integer DEFAULT 0
created_at  timestamptz DEFAULT now()
```

### 1.2 `services` — услуги

```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
category_id  uuid REFERENCES categories(id)
name         text NOT NULL
short_desc   text                       -- для списка каталога
description  text                       -- для экрана деталей
duration     integer NOT NULL           -- минуты (90, 120, 45...)
price        integer NOT NULL           -- рублей (1800)
price_note   text                       -- '* Дизайн включён' или NULL
gradient     text                       -- 'linear-gradient(135deg, ...)'
emoji        text                       -- '💅'
is_available boolean DEFAULT true       -- false = 'Нет слотов'
sort_order   integer DEFAULT 0
created_at   timestamptz DEFAULT now()
updated_at   timestamptz DEFAULT now()
```

### 1.3 `service_photos` — фото услуг

```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
service_id    uuid REFERENCES services(id) ON DELETE CASCADE
storage_path  text NOT NULL   -- путь в Supabase Storage: 'services/uuid/photo.jpg'
sort_order    integer DEFAULT 0
created_at    timestamptz DEFAULT now()
```

### 1.4 `work_schedule` — график работы

Ключевая таблица. Хранит два типа записей:
- **Еженедельный шаблон** (`day_of_week` заполнен, `specific_date` = NULL)
- **Переопределение конкретной даты** (`specific_date` заполнен, `day_of_week` = NULL)

```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
day_of_week   integer          -- 0=вс, 1=пн ... 6=сб; NULL если конкретная дата
specific_date date             -- NULL если еженедельный шаблон
is_working    boolean NOT NULL -- false = выходной
start_time    time             -- '10:00' (NULL если is_working=false)
end_time      time             -- '20:00' (NULL если is_working=false)
break_start   time             -- '13:00' (NULL = нет перерыва)
break_end     time             -- '14:00' (NULL = нет перерыва)
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()

-- Уникальность:
UNIQUE (day_of_week) WHERE specific_date IS NULL
UNIQUE (specific_date) WHERE day_of_week IS NULL
```

**Примеры записей:**

| day_of_week | specific_date | is_working | start_time | end_time | break_start | break_end |
|---|---|---|---|---|---|---|
| 1 (пн) | NULL | true | 10:00 | 20:00 | 13:00 | 14:00 |
| 0 (вс) | NULL | false | NULL | NULL | NULL | NULL |
| NULL | 2026-04-01 | false | NULL | NULL | NULL | NULL | ← отпуск |
| NULL | 2026-03-08 | true | 10:00 | 14:00 | NULL | NULL | ← короткий день |

**Логика приоритетов при расчёте слотов:**
1. Если есть запись с `specific_date` = нужная дата → использовать её
2. Иначе найти запись с `day_of_week` = день недели этой даты
3. Если записи нет → день нерабочий (защитное поведение)

### 1.5 `bookings` — записи клиентов

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
telegram_user_id    bigint NOT NULL         -- ID клиента из initData
telegram_first_name text NOT NULL
telegram_last_name  text                    -- может быть NULL
telegram_username   text                    -- может быть NULL

service_id          uuid REFERENCES services(id)
service_name        text NOT NULL           -- денормализовано: имя на момент записи
service_price       integer NOT NULL        -- денормализовано: цена на момент записи
service_duration    integer NOT NULL        -- денормализовано: длительность в минутах

booking_date        date NOT NULL           -- '2026-03-19'
start_time          time NOT NULL           -- '14:00'
end_time            time NOT NULL           -- '15:30' (start_time + duration)

status              text NOT NULL DEFAULT 'confirmed'
                    -- 'confirmed' | 'done' | 'cancelled' | 'no_show'
cancelled_by        text                    -- 'client' | 'master' | NULL
cancel_reason       text                    -- причина отмены мастером

created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### 1.6 `master_settings` — настройки профиля мастера

```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
name             text NOT NULL              -- 'Катя'
full_name        text NOT NULL              -- 'Екатерина Соколова'
title            text NOT NULL              -- 'Мастер маникюра и педикюра'
bio              text
rating           numeric(3,1) DEFAULT 5.0
review_count     integer DEFAULT 0
experience       integer                    -- лет опыта
address          text
city             text
map_url          text
telegram_username text                      -- для кнопки «Написать»
bot_username     text                       -- для кнопки «Поделиться»
cancellation_policy text
photo_path       text                       -- путь в Supabase Storage
updated_at       timestamptz DEFAULT now()
```

---

## 2. Supabase Storage — структура бакетов

```
bucket: beauty-catalog   (public read, auth write)
│
├── master/
│   └── avatar.jpg              ← фото мастера
│
└── services/
    ├── {service_id}/
    │   ├── photo_1.jpg
    │   ├── photo_2.jpg
    │   └── photo_3.jpg
    └── ...
```

---

## 3. Алгоритм расчёта свободных слотов

Это главная бизнес-логика. Вызывается при GET `/api/slots`.

```
Входные данные:
  - date: '2026-03-19'
  - service_id: uuid (нужна длительность)

Шаг 1: Получить график на эту дату
  - Ищем specific_date = date в work_schedule
  - Если нет → ищем day_of_week = день недели date
  - Если is_working = false → вернуть [] (выходной)

Шаг 2: Получить все занятые блоки на эту дату
  SELECT start_time, end_time FROM bookings
  WHERE booking_date = date
    AND status IN ('confirmed')
  → список занятых интервалов: [(10:00, 11:30), (14:00, 16:00), ...]

Шаг 3: Добавить перерыв к занятым блокам
  Если break_start и break_end не NULL:
    добавить (break_start, break_end) в список занятых

Шаг 4: Генерировать кандидатов каждые 30 минут
  от start_time до end_time - service.duration

Шаг 5: Для каждого кандидата slot_start:
  slot_end = slot_start + service.duration
  Проверить: НЕ пересекается ни с одним занятым блоком
  И slot_end <= end_time

  Пересечение: slot_start < busy_end AND slot_end > busy_start

  Если свободен → добавить в результат

Вернуть: список свободных времён ['10:00', '10:30', '11:30', ...]
```

**Пример:**
- Рабочий день: 10:00–20:00, обед 13:00–14:00
- Занято: Маникюр 90 мин в 11:00 (→ до 12:30)
- Запрос: педикюр 120 мин
- Кандидаты: 10:00, 10:30, 11:00, 11:30, 12:00...
- 10:00: 10:00–12:00 — свободно ✅
- 10:30: 10:30–12:30 — пересекается с 11:00–12:30 ❌
- 11:00: пересекается ❌
- 11:30: пересекается ❌
- 12:00: 12:00–14:00 — пересекается с обедом 13:00–14:00 ❌
- 14:00: 14:00–16:00 — свободно ✅
- ...

---

## 4. API-эндпоинты

### Публичные (клиент)

| Метод | URL | Что делает |
|---|---|---|
| GET | `/api/services` | Все услуги с фото |
| GET | `/api/categories` | Все категории |
| GET | `/api/slots?date=&service_id=` | Свободные слоты (алгоритм из §3) |
| POST | `/api/bookings` | Создать запись |
| GET | `/api/bookings?telegram_user_id=` | Записи конкретного клиента |
| PATCH | `/api/bookings/:id/cancel` | Отменить запись (только свою) |
| GET | `/api/master` | Публичный профиль мастера |

### Мастер (защищены MASTER_TELEGRAM_ID)

| Метод | URL | Что делает |
|---|---|---|
| GET | `/api/master/bookings` | Все записи (фильтры: дата, статус) |
| PATCH | `/api/master/bookings/:id` | Изменить статус (done, no_show, cancel) |
| GET | `/api/master/services` | Список услуг для редактирования |
| POST | `/api/master/services` | Добавить услугу |
| PATCH | `/api/master/services/:id` | Редактировать услугу |
| DELETE | `/api/master/services/:id` | Удалить услугу |
| POST | `/api/master/services/:id/photos` | Загрузить фото (multipart) |
| DELETE | `/api/master/services/:id/photos/:photo_id` | Удалить фото |
| GET | `/api/master/schedule` | Получить график |
| PUT | `/api/master/schedule` | Сохранить весь график |
| GET | `/api/master/settings` | Настройки профиля |
| PATCH | `/api/master/settings` | Обновить профиль |
| POST | `/api/master/settings/photo` | Загрузить фото мастера |

---

## 5. Безопасность

### Проверка запросов от клиента

Каждый запрос к API должен содержать заголовок:
```
X-Telegram-Init-Data: <значение window.Telegram.WebApp.initData>
```

На сервере:
```js
function validateInitData(initDataStr, botToken) {
  const params = new URLSearchParams(initDataStr);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (hash !== expected) throw new Error('Invalid signature');
  if (Date.now() / 1000 - parseInt(params.get('auth_date')) > 86400) throw new Error('Expired');

  return JSON.parse(params.get('user')); // { id, first_name, ... }
}
```

### Проверка запросов от мастера

```js
function requireMaster(user) {
  if (String(user.id) !== process.env.MASTER_TELEGRAM_ID) {
    throw new Error('Forbidden');
  }
}
```

### Переменные окружения (добавить в Vercel)

```
BOT_TOKEN=...                  # уже есть
SUPABASE_URL=...               # из Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=...  # из Supabase → Settings → API
MASTER_TELEGRAM_ID=...         # ваш Telegram ID (узнать через @userinfobot)
```

---

## 6. Панель мастера в Mini App

Добавляется **четвёртая вкладка** в нижней навигации — видна только мастеру.

```
[ 💅 Услуги ]  [ 📅 Записи ]  [ 👤 О мастере ]  [ 🔧 Мастер ]
                                                  ↑ только для мастера
```

Проверка при инициализации:
```js
const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
if (String(user?.id) === MASTER_TG_ID) {
  // показать вкладку Мастер
}
```

### Экраны панели мастера

#### М1: Расписание (стартовый экран панели)

```
[ Сегодня ] [ Завтра ] [ Вт 19 ] [ Ср 20 ] ...  ← горизонтальный скролл

Среда, 19 марта · 4 записи

┌─────────────────────────────────┐
│  10:00 – 11:30  Маникюр         │
│  Анна · Подтверждено      [●]   │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  11:30 – 12:30  Педикюр         │
│  Мария · Подтверждено     [●]   │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  13:00 – 14:00  🍽 Перерыв      │ ← серый блок
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  14:30 – ...   Свободно         │ ← светлый блок
└─────────────────────────────────┘
```

Действия на карточке записи:
- Тап → развернуть детали (имя, телефон, услуга, статус)
- Кнопки: «Завершено» / «Не пришёл» / «Отменить»

#### М2: Услуги — управление каталогом

```
[ + Добавить услугу ]

┌─────────────────────────────────┐
│ 💅 Маникюр с гель-лаком   90мин │
│ 1 800 ₽  ● Активна   [📷 3] [✏] │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ ✨ Маникюр классический   60мин │
│ 1 200 ₽  ○ Скрыта    [📷 2] [✏] │
└─────────────────────────────────┘
```

Редактирование услуги (отдельный экран):
- Название, описание, категория, длительность, цена, примечание к цене
- Переключатель «Доступна / Скрыта»
- Фото: превью загруженных + кнопка «+ Добавить фото» (input file)
- «Удалить услугу» (с подтверждением)

#### М3: График работы

Два раздела:

**Раздел А: Еженедельный шаблон** (как будильник)

```
Пн  ●  10:00 – 20:00  🍽 13:00–14:00  [✏]
Вт  ●  10:00 – 20:00  🍽 13:00–14:00  [✏]
Ср  ●  10:00 – 20:00  🍽 13:00–14:00  [✏]
Чт  ●  10:00 – 20:00  🍽 13:00–14:00  [✏]
Пт  ●  10:00 – 20:00  🍽 13:00–14:00  [✏]
Сб  ●  10:00 – 17:00  —               [✏]
Вс  ○  Выходной                        [✏]
```

Редактирование дня:
- Переключатель «Рабочий / Выходной»
- Если рабочий: время начала, время конца
- Перерыв: «Нет перерыва» или задать начало/конец

**Раздел Б: Конкретные даты** (исключения)

```
[ + Заблокировать дату / Задать особый график ]

07 апр 2026  Выходной (отпуск)        [✕]
08 апр 2026  10:00–14:00 (короткий)   [✕]
09 апр 2026  Выходной (отпуск)        [✕]
```

#### М4: Настройки профиля

- Имя, полное имя, должность, биография
- Адрес, город, ссылка на карту
- Telegram-юзернейм, юзернейм бота
- Политика отмены
- Фото мастера (input file)
- Кнопка «Сохранить»

---

## 7. Изменения в существующем фронтенде

### data.js → удаляется из логики

Данные больше не хранятся в `data.js` как константы.
Вместо этого приложение загружает их с сервера при старте:

```js
// Вместо const SERVICES = [...]
async function loadCatalog() {
  const [services, categories] = await Promise.all([
    fetch('/api/services').then(r => r.json()),
    fetch('/api/categories').then(r => r.json()),
  ]);
  STATE.services = services;
  STATE.categories = categories;
}
```

`data.js` остаётся только для вспомогательных функций форматирования:
`formatDateLong`, `formatDateShort`, `formatDayPill`, `calcEndTime`, `formatPrice`, `formatDuration`.

### app.js — изменения

1. `generateSlots()` заменяется на `fetch('/api/slots?date=&service_id=')`
2. `saveBooking()` → `POST /api/bookings` + локальное сохранение как кэш
3. `loadBookings()` → `GET /api/bookings?telegram_user_id=` + fallback на localStorage
4. Инициализация: загружать каталог с сервера, показывать skeleton пока грузится
5. Добавить 4-ю вкладку «Мастер» + проверку `MASTER_TELEGRAM_ID`

### Отправка initData в каждый запрос

```js
const headers = {
  'Content-Type': 'application/json',
  'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
};
```

---

## 8. Структура файлов после реализации

```
tg-app/
├── index.html
├── css/
│   └── styles.css        (+ стили панели мастера)
├── js/
│   ├── data.js           (только форматирование, без SERVICES/MASTER)
│   ├── app.js            (+ загрузка данных с API, + вкладка мастера)
│   └── master.js         (NEW — экраны М1–М4, управление услугами/графиком)
└── api/
    ├── webhook.js         (бот /start /help — уже есть)
    ├── services.js        (GET /api/services)
    ├── categories.js      (GET /api/categories)
    ├── slots.js           (GET /api/slots)
    ├── bookings.js        (GET, POST /api/bookings)
    ├── bookings/
    │   └── [id]/
    │       ├── cancel.js  (PATCH /api/bookings/:id/cancel)
    └── master/
        ├── bookings.js    (GET, PATCH — панель мастера)
        ├── services.js    (GET, POST, PATCH, DELETE)
        ├── services/
        │   └── [id]/
        │       └── photos.js
        ├── schedule.js    (GET, PUT)
        └── settings.js    (GET, PATCH, POST photo)
```

---

## 9. Порядок реализации

| Шаг | Что делать | Результат |
|---|---|---|
| 1 | Создать Supabase проект, таблицы из §1, бакет Storage | База готова |
| 2 | Заполнить начальные данные (мигрировать из data.js) | Данные в БД |
| 3 | API: `/api/services`, `/api/categories`, `/api/master` | Каталог с БД |
| 4 | API: `/api/slots` с алгоритмом из §3 | Умные слоты |
| 5 | API: `/api/bookings` POST + GET | Запись работает |
| 6 | Обновить фронтенд: загрузка с API вместо data.js | End-to-end флоу |
| 7 | API мастера: `/api/master/bookings` + экран М1 | Мастер видит записи |
| 8 | API мастера: `/api/master/services` + экран М2 | Управление услугами |
| 9 | API мастера: `/api/master/schedule` + экран М3 | Управление графиком |
| 10 | API мастера: `/api/master/settings` + экран М4 | Настройки профиля |
| 11 | Загрузка фото (Storage) — услуги + мастер | Реальные фото |
| 12 | Тестирование алгоритма слотов, деплой | Готово |
