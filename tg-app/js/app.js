/**
 * app.js — Главный модуль приложения Beauty Catalog TMA
 *
 * Структура файла:
 *   1.  СОСТОЯНИЕ          — глобальный объект STATE
 *   2.  TELEGRAM API       — обёртка с fallback для браузера
 *   3.  РОУТЕР             — navigate(), navigateBack()
 *   4.  НИЖНЯЯ НАВИГАЦИЯ   — renderNav(), updateNav()
 *   5.  SKELETON           — showSkeleton()
 *   6.  ЭКРАНЫ:
 *         renderCatalog()
 *         renderServiceDetail()
 *         renderBookingDate()
 *         renderBookingConfirm()
 *         renderBookingSuccess()
 *         renderMyBookings()
 *         renderAbout()
 *   7.  КАРУСЕЛЬ           — initCarousel()
 *   8.  ЗАПИСИ             — saveBooking(), loadBookings()
 *   9.  ИНИЦИАЛИЗАЦИЯ      — init()
 */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. СОСТОЯНИЕ
══════════════════════════════════════════════════════════════ */

const STATE = {
  screen: 'catalog',    // текущий экран
  history: [],          // стек для BackButton (имена экранов)
  category: 'all',      // выбранная категория в каталоге
  service: null,        // выбранная услуга (объект из SERVICES)

  // Данные текущей записи
  booking: {
    service: null,      // объект услуги
    date: null,         // 'YYYY-MM-DD'
    time: null,         // 'HH:MM'
    endTime: null,      // 'HH:MM'
  },

  bookings: [],         // сохранённые записи (localStorage)
  slots: null,          // кэш расписания (генерируется один раз)
};

/* ══════════════════════════════════════════════════════════════
   2. TELEGRAM API — обёртка с fallback для браузерного превью
══════════════════════════════════════════════════════════════ */

const TG = {
  get wa() { return window.Telegram?.WebApp; },

  /** Инициализировать Telegram Web App */
  init() {
    if (!this.wa) return;
    this.wa.ready();    // Сообщаем Telegram что приложение загружено
    this.wa.expand();   // Разворачиваем на весь экран

    // Обновляем высоту вьюпорта при изменении (клавиатура и т.д.)
    this.wa.onEvent('viewportChanged', ({ isStateStable }) => {
      if (isStateStable) {
        document.documentElement.style.setProperty(
          '--viewport-height', `${this.wa.viewportHeight}px`
        );
      }
    });
  },

  /** Имя пользователя из Telegram */
  getUserName() {
    const user = this.wa?.initDataUnsafe?.user;
    if (!user) return 'Клиент';
    return user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.first_name;
  },

  // ── HapticFeedback ──────────────────────────────────────────

  haptic: {
    selection() {
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    },
    impact(style = 'medium') {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    },
    success() {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    },
    error() {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    },
  },

  // ── BackButton ───────────────────────────────────────────────

  backBtn: {
    show(callback) {
      const btn = window.Telegram?.WebApp?.BackButton;
      if (!btn) return;
      btn.offClick(); // Удаляем старый обработчик
      btn.onClick(callback);
      btn.show();
    },
    hide() {
      window.Telegram?.WebApp?.BackButton?.hide();
    },
  },

  // ── MainButton ───────────────────────────────────────────────

  mainBtn: {
    _handler: null,
    show(text, callback, color) {
      const btn = window.Telegram?.WebApp?.MainButton;
      if (!btn) return;
      if (this._handler) btn.offClick(this._handler);
      this._handler = callback;
      btn.setText(text);
      if (color) btn.color = color;
      btn.onClick(this._handler);
      btn.enable();
      btn.show();
    },
    hide() {
      const btn = window.Telegram?.WebApp?.MainButton;
      if (!btn) return;
      if (this._handler) { btn.offClick(this._handler); this._handler = null; }
      btn.hide();
    },
    setLoading(loading) {
      const btn = window.Telegram?.WebApp?.MainButton;
      if (!btn) return;
      if (loading) { btn.showProgress(true); btn.disable(); }
      else { btn.hideProgress(); btn.enable(); }
    },
    setText(text) {
      window.Telegram?.WebApp?.MainButton?.setText(text);
    },
  },

  // ── Попапы ──────────────────────────────────────────────────

  confirm(message, callback) {
    if (window.Telegram?.WebApp?.showConfirm) {
      this.wa.showConfirm(message, callback);
    } else {
      callback(window.confirm(message));
    }
  },

  alert(message) {
    if (window.Telegram?.WebApp?.showAlert) {
      this.wa.showAlert(message);
    } else {
      window.alert(message);
    }
  },

  openTelegramChat(username) {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      this.wa.openTelegramLink(`https://t.me/${username}`);
    } else {
      window.open(`https://t.me/${username}`, '_blank');
    }
  },

  openLink(url) {
    if (window.Telegram?.WebApp?.openLink) {
      this.wa.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  },
};

/* ══════════════════════════════════════════════════════════════
   3. РОУТЕР
══════════════════════════════════════════════════════════════ */

const view    = document.getElementById('view');
const bottomNav = document.getElementById('bottom-nav');

/**
 * Переход на экран вперёд.
 * @param {string} screen  — имя экрана
 * @param {object} params  — дополнительные данные (опционально)
 */
function navigate(screen, params = {}) {
  STATE.history.push(STATE.screen);
  _render(screen, params, 'forward');
}

/** Переход назад по истории */
function navigateBack() {
  if (STATE.history.length === 0) return;
  const prev = STATE.history.pop();
  _render(prev, {}, 'back');
}

/**
 * Переход на корневой таб без сохранения в историю.
 * @param {string} screen — 'catalog' | 'my-bookings' | 'about'
 */
function navigateTab(screen) {
  // Сбрасываем историю при переключении табов
  STATE.history = [];
  _render(screen, {}, 'forward');
}

/** Внутренняя функция — рендер + анимация */
function _render(screen, params, direction) {
  STATE.screen = screen;

  // ── Определяем, это таб-экран или воронка ──────────────────
  const isTabScreen = ['catalog', 'my-bookings', 'about'].includes(screen);

  // ── Нижняя навигация ───────────────────────────────────────
  if (isTabScreen) {
    bottomNav.classList.remove('hidden');
    updateNav(screen);
  } else {
    bottomNav.classList.add('hidden');
  }

  // ── BackButton ─────────────────────────────────────────────
  if (!isTabScreen && STATE.history.length > 0) {
    TG.backBtn.show(navigateBack);
  } else {
    TG.backBtn.hide();
  }

  // ── Скрыть MainButton по умолчанию ────────────────────────
  // Каждый экран сам покажет его если нужно
  TG.mainBtn.hide();

  // ── Создаём новый экран ───────────────────────────────────
  const newEl = document.createElement('div');
  newEl.className = `screen screen-enter-${direction}`;

  // ── Рендерим контент ──────────────────────────────────────
  newEl.innerHTML = _getScreenHTML(screen, params);

  // ── Уходящий экран ────────────────────────────────────────
  const oldEl = view.querySelector('.screen');
  if (oldEl) {
    oldEl.classList.remove('screen-enter-forward', 'screen-enter-back');
    oldEl.classList.add(`screen-exit-${direction}`);
    setTimeout(() => oldEl.remove(), 260);
  }

  view.appendChild(newEl);

  // Успех — особая анимация
  if (screen === 'booking-success') {
    newEl.classList.add('screen-fade-in');
    newEl.classList.remove(`screen-enter-${direction}`);
  }

  // ── Вешаем обработчики событий ────────────────────────────
  setTimeout(() => _attachHandlers(screen, newEl), 10);
}

/** Возвращает HTML нужного экрана */
function _getScreenHTML(screen, params) {
  switch (screen) {
    case 'onboarding':      return renderOnboarding();
    case 'catalog':         return renderCatalog();
    case 'service-detail':  return renderServiceDetail();
    case 'booking-date':    return renderBookingDate();
    case 'booking-confirm': return renderBookingConfirm();
    case 'booking-success': return renderBookingSuccess();
    case 'my-bookings':     return renderMyBookings();
    case 'about':           return renderAbout();
    default:                return '<div style="padding:20px">Экран не найден</div>';
  }
}

/** Вешает обработчики событий для конкретного экрана */
function _attachHandlers(screen, el) {
  switch (screen) {
    case 'onboarding':      attachOnboardingHandlers(el);     break;
    case 'catalog':         attachCatalogHandlers(el);        break;
    case 'service-detail':  attachServiceDetailHandlers(el);  break;
    case 'booking-date':    attachBookingDateHandlers(el);     break;
    case 'booking-confirm': attachBookingConfirmHandlers(el);  break;
    case 'booking-success': attachSuccessHandlers(el);         break;
    case 'my-bookings':     attachMyBookingsHandlers(el);      break;
    case 'about':           attachAboutHandlers(el);           break;
  }
}

/* ══════════════════════════════════════════════════════════════
   4. НИЖНЯЯ НАВИГАЦИЯ
══════════════════════════════════════════════════════════════ */

function updateNav(activeScreen) {
  const items = bottomNav.querySelectorAll('.nav-item');
  items.forEach(item => {
    item.classList.toggle('active', item.dataset.screen === activeScreen);
  });
}

/* ══════════════════════════════════════════════════════════════
   5. SKELETON ЗАГРУЗКА
══════════════════════════════════════════════════════════════ */

function skeletonCatalog() {
  return Array(3).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-photo"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-40"></div>
        <div class="skeleton skeleton-line w-100"></div>
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════════
   6. ЭКРАНЫ
══════════════════════════════════════════════════════════════ */

// ── ЭКРАН 0: ОНБОРДИНГ (первый запуск) ───────────────────────

const ONBOARDING_KEY = 'beauty_onboarded';

function renderOnboarding() {
  const name = TG.getUserName();
  return `
    <div class="onboarding-screen">
      <span class="onboarding-emoji">💅</span>
      <div class="onboarding-greeting">Привет, ${name}!</div>
      <div class="onboarding-subtitle">
        Добро пожаловать в каталог<br>бьюти-услуг
      </div>

      <div class="onboarding-features">
        <div class="onboarding-feature">
          <span class="onboarding-feature__icon">📋</span>
          <div class="onboarding-feature__text">Выбирайте услугу и записывайтесь онлайн — без звонков</div>
        </div>
        <div class="onboarding-feature">
          <span class="onboarding-feature__icon">📅</span>
          <div class="onboarding-feature__text">Удобное расписание: сами выбираете день и время</div>
        </div>
        <div class="onboarding-feature">
          <span class="onboarding-feature__icon">🔔</span>
          <div class="onboarding-feature__text">Напомним о визите за день — ничего не забудете</div>
        </div>
      </div>

      <button class="btn-primary" id="btn-onboarding-start">Начать →</button>
    </div>
  `;
}

function attachOnboardingHandlers(el) {
  el.querySelector('#btn-onboarding-start').addEventListener('click', () => {
    TG.haptic.impact('medium');
    localStorage.setItem(ONBOARDING_KEY, '1');
    STATE.history = [];
    navigateTab('catalog');
  });
}

// ── ЭКРАН 1: КАТАЛОГ ─────────────────────────────────────────

/** Генерирует HTML компактного списка услуг */
function renderServiceItems(services) {
  if (services.length === 0) {
    return `<div class="services-empty">🌸 В этой категории пока нет услуг</div>`;
  }
  const items = services.map(s => `
    <div class="service-item ${!s.available ? 'service-item--unavailable' : ''}" data-id="${s.id}">
      <div class="service-item__icon" style="background:${s.gradient}">${s.emoji}</div>
      <div class="service-item__info">
        <div class="service-item__name">${s.name}</div>
        <div class="service-item__meta">⏱ ${formatDuration(s.duration)}${!s.available ? ' · Нет слотов' : ''}</div>
      </div>
      <div class="service-item__right">
        <span class="service-item__price">${formatPrice(s.price)}</span>
        <span class="service-item__chevron">›</span>
      </div>
    </div>
  `).join('');
  return `<div class="services-section">${items}</div>`;
}

function renderCatalog() {
  const filtered = STATE.category === 'all'
    ? SERVICES
    : SERVICES.filter(s => s.categoryId === STATE.category);

  const categoriesHTML = CATEGORIES.map(cat => `
    <button class="category-pill ${cat.id === STATE.category ? 'active' : ''}"
            data-cat="${cat.id}">
      ${cat.emoji} ${cat.name}
    </button>
  `).join('');

  // Портфолио — первые 6 услуг как мини-фото
  const portfolioHTML = SERVICES.slice(0, 6).map(s => `
    <div class="portfolio-thumb" style="background:${s.gradient}">${s.emoji}</div>
  `).join('');

  return `
    <div class="screen-content">
      <!-- Шапка с аватаром мастера -->
      <div class="master-header">
        <div class="master-avatar">💅</div>
        <div class="master-info">
          <div class="master-info__name">${MASTER.name}</div>
          <div class="master-info__sub">
            ${MASTER.title} &nbsp;·&nbsp;
            <span class="rating-star">★</span> ${MASTER.rating}
          </div>
        </div>
      </div>

      <!-- Портфолио -->
      <div class="portfolio-row">${portfolioHTML}</div>

      <!-- Категории -->
      <div class="categories">
        ${categoriesHTML}
      </div>

      <!-- Компактный список услуг -->
      <div class="services-section-wrap" id="services-list">
        ${renderServiceItems(filtered)}
      </div>
    </div>
  `;
}

function attachCatalogHandlers(el) {
  // Клики по категориям
  el.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic.selection();
      STATE.category = btn.dataset.cat;

      el.querySelectorAll('.category-pill').forEach(p =>
        p.classList.toggle('active', p.dataset.cat === STATE.category)
      );

      const filtered = STATE.category === 'all'
        ? SERVICES
        : SERVICES.filter(s => s.categoryId === STATE.category);

      el.querySelector('#services-list').innerHTML = renderServiceItems(filtered);
      attachServiceItemHandlers(el);
    });
  });

  attachServiceItemHandlers(el);
}

function attachServiceItemHandlers(el) {
  // Тап на строку услуги — открыть детали
  el.querySelectorAll('.service-item:not(.service-item--unavailable)').forEach(item => {
    item.addEventListener('click', () => {
      const service = SERVICES.find(s => s.id === item.dataset.id);
      if (!service) return;
      TG.haptic.impact('light');
      STATE.service = service;
      STATE.booking.service = service;
      navigate('service-detail');
    });
  });
}

// ── ЭКРАН 2: ДЕТАЛИ УСЛУГИ ───────────────────────────────────

function renderServiceDetail() {
  const s = STATE.service;
  if (!s) return '<div style="padding:20px">Ошибка</div>';

  // Генерируем слайды карусели
  const slidesHTML = Array.from({ length: s.photos }, (_, i) => `
    <div class="carousel__slide" style="background:${s.gradient}; flex-shrink:0; width:100%">
      <span style="font-size:${i === 0 ? '80px' : '60px'}">${i % 2 === 0 ? s.emoji : '✨'}</span>
    </div>
  `).join('');

  const dotsHTML = s.photos > 1
    ? `<div class="carousel__dots">
         ${Array.from({ length: s.photos }, (_, i) =>
           `<div class="carousel__dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>`
         ).join('')}
       </div>`
    : '';

  return `
    <div class="service-detail screen-funnel">
      <!-- Карусель фото -->
      <div class="carousel" id="carousel">
        <div class="carousel__track" id="carousel-track">
          ${slidesHTML}
        </div>
      </div>
      ${dotsHTML}

      <!-- Тело -->
      <div class="detail-body">
        <h1 class="detail-name">${s.name}</h1>
        <p class="detail-desc">${s.description}</p>

        <div class="detail-badges">
          <div class="badge badge--duration">⏱ ${formatDuration(s.duration)}</div>
          <div class="badge badge--price">${formatPrice(s.price)}</div>
        </div>

        ${s.priceNote ? `<p class="text-hint text-small mb-16">* ${s.priceNote}</p>` : ''}

        <div class="divider"></div>

        <div class="detail-policy">
          <div class="detail-policy__title">📋 Политика отмены</div>
          ${MASTER.cancellationPolicy}
        </div>
      </div>

      <!-- Fallback-кнопка для браузера (в Telegram используется MainButton) -->
      <div class="page-cta-wrap" id="page-cta" style="display:none">
        <button class="btn-primary" id="btn-book-now">Записаться</button>
      </div>
    </div>
  `;
}

function attachServiceDetailHandlers(el) {
  // Инициализируем карусель
  initCarousel(el);

  const onBook = () => {
    TG.haptic.impact('medium');
    STATE.booking.date = null;
    STATE.booking.time = null;
    STATE.booking.endTime = null;
    navigate('booking-date');
  };

  if (window.Telegram?.WebApp?.initData) {
    // В Telegram — нативная MainButton
    TG.mainBtn.show('Записаться', onBook);
  } else {
    // В браузере — показываем встроенную кнопку
    el.querySelector('#page-cta').style.display = 'block';
    el.querySelector('#btn-book-now').addEventListener('click', onBook);
  }
}

// ── ЭКРАН 3: ВЫБОР ДАТЫ И ВРЕМЕНИ ────────────────────────────

function renderBookingDate() {
  // Инициализируем слоты если нет
  if (!STATE.slots) {
    STATE.slots = generateSlots();
  }

  const s = STATE.booking.service;
  const slotDays = Object.keys(STATE.slots);

  const daysHTML = slotDays.map(dateStr => {
    const { dayName, dayNum } = formatDayPill(dateStr);
    const hasSlots = STATE.slots[dateStr].some(sl => !sl.busy);
    const isSelected = STATE.booking.date === dateStr;
    return `
      <button class="day-pill ${isSelected ? 'selected' : ''} ${!hasSlots ? 'unavailable' : ''}"
              data-date="${dateStr}" ${!hasSlots ? 'disabled' : ''}>
        <span class="day-pill__name">${dayName}</span>
        <span class="day-pill__num">${dayNum}</span>
      </button>
    `;
  }).join('');

  // Слоты для выбранной даты
  const slotsHTML = STATE.booking.date
    ? renderSlots(STATE.slots[STATE.booking.date])
    : `<div class="slots-empty">👆 Выберите удобную дату</div>`;

  return `
    <div class="booking-date screen-funnel">
      <div class="booking-header">
        <div class="booking-header__service">${s?.name || ''}</div>
        <div class="booking-header__label">Выберите дату</div>
      </div>

      <!-- Горизонтальный скролл дней -->
      <div class="date-picker" id="date-picker">
        ${daysHTML}
      </div>

      <!-- Слоты -->
      <div class="slots-section" id="slots-section">
        ${slotsHTML}
      </div>

      <!-- Fallback-кнопка для браузера -->
      <div class="page-cta-wrap" id="page-cta" style="display:none">
        <button class="btn-primary" id="btn-next-confirm" disabled>Выберите время</button>
      </div>
    </div>
  `;
}

function renderSlots(daySlots) {
  if (!daySlots || daySlots.length === 0) {
    return `<div class="slots-empty">На эту дату все записи заняты</div>`;
  }

  const slotsHTML = daySlots.map(slot => `
    <button class="slot-btn ${slot.busy ? '' : ''} ${STATE.booking.time === slot.time ? 'selected' : ''}"
            data-time="${slot.time}"
            ${slot.busy ? 'disabled' : ''}>
      ${slot.busy ? '——' : slot.time}
    </button>
  `).join('');

  return `
    <div class="slots-section__title">Доступное время</div>
    <div class="slots-grid">${slotsHTML}</div>
  `;
}

function attachBookingDateHandlers(el) {
  const inTg = !!window.Telegram?.WebApp?.initData;
  const pageCta = el.querySelector('#page-cta');
  const pageBtn = el.querySelector('#btn-next-confirm');

  // В браузере — показываем встроенную кнопку
  if (!inTg && pageCta) {
    pageCta.style.display = 'block';
    pageBtn.addEventListener('click', goToConfirm);
  }

  // Выбор дня
  el.querySelectorAll('.day-pill:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic.selection();
      STATE.booking.date = btn.dataset.date;
      STATE.booking.time = null;  // Сбрасываем выбранное время

      // Обновляем выделение дней
      el.querySelectorAll('.day-pill').forEach(b =>
        b.classList.toggle('selected', b.dataset.date === STATE.booking.date)
      );

      // Рендерим слоты
      const section = el.querySelector('#slots-section');
      section.innerHTML = renderSlots(STATE.slots[STATE.booking.date]);

      // Вешаем обработчики на слоты
      attachSlotHandlers(el);

      // Сбрасываем кнопку «Далее» — время не выбрано
      if (inTg) {
        TG.mainBtn.show('Выберите время', () => {}, null);
        window.Telegram?.WebApp?.MainButton?.disable();
      } else if (pageBtn) {
        pageBtn.disabled = true;
        pageBtn.textContent = 'Выберите время';
      }
    });
  });

  attachSlotHandlers(el);

  // Восстанавливаем кнопку если время уже выбрано (возврат назад)
  if (STATE.booking.time) {
    const dateShort = formatDateShort(STATE.booking.date);
    const label = `Далее — ${dateShort}, ${STATE.booking.time}`;
    if (inTg) {
      TG.mainBtn.show(label, goToConfirm);
    } else if (pageBtn) {
      pageBtn.disabled = false;
      pageBtn.textContent = label;
    }
  } else if (inTg) {
    TG.mainBtn.show('Выберите время', () => {}, null);
    window.Telegram?.WebApp?.MainButton?.disable();
  }
}

function attachSlotHandlers(el) {
  el.querySelectorAll('.slot-btn:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic.selection();
      STATE.booking.time = btn.dataset.time;
      STATE.booking.endTime = calcEndTime(btn.dataset.time, STATE.booking.service.duration);

      // Выделяем слот
      el.querySelectorAll('.slot-btn').forEach(b =>
        b.classList.toggle('selected', b.dataset.time === STATE.booking.time)
      );

      // Активируем кнопку «Далее»
      const dateShort = formatDateShort(STATE.booking.date);
      const label = `Далее — ${dateShort}, ${STATE.booking.time}`;
      TG.mainBtn.show(label, goToConfirm);

      // Fallback для браузера
      const pageBtn = el.querySelector('#btn-next-confirm');
      if (pageBtn) {
        pageBtn.disabled = false;
        pageBtn.textContent = label;
      }
    });
  });
}

function goToConfirm() {
  if (!STATE.booking.date || !STATE.booking.time) {
    TG.alert('Пожалуйста, выберите дату и время');
    return;
  }
  TG.haptic.impact('medium');
  navigate('booking-confirm');
}

// ── ЭКРАН 4: ПОДТВЕРЖДЕНИЕ ────────────────────────────────────

function renderBookingConfirm() {
  const { service, date, time, endTime } = STATE.booking;
  const userName = TG.getUserName();

  return `
    <div class="confirm-screen screen-funnel">
      <h1 class="confirm-title">✦ Ваша запись</h1>

      <!-- Карточка с деталями -->
      <div class="confirm-card">
        <div class="confirm-row">
          <div class="confirm-row__icon">💅</div>
          <div>
            <div class="confirm-row__label">Услуга</div>
            <div class="confirm-row__value">${service?.name}</div>
          </div>
        </div>
        <div class="confirm-row">
          <div class="confirm-row__icon">📅</div>
          <div>
            <div class="confirm-row__label">Дата</div>
            <div class="confirm-row__value">${formatDateLong(date)}</div>
          </div>
        </div>
        <div class="confirm-row">
          <div class="confirm-row__icon">🕐</div>
          <div>
            <div class="confirm-row__label">Время</div>
            <div class="confirm-row__value">${time} — ${endTime} (${formatDuration(service?.duration)})</div>
          </div>
        </div>
        <div class="confirm-row">
          <div class="confirm-row__icon">💰</div>
          <div>
            <div class="confirm-row__label">Стоимость</div>
            <div class="confirm-row__value">${formatPrice(service?.price)}</div>
          </div>
        </div>
      </div>

      <!-- Карточка клиента -->
      <div class="confirm-card">
        <div class="confirm-row">
          <div class="confirm-row__icon">👤</div>
          <div>
            <div class="confirm-row__label">Клиент</div>
            <div class="confirm-row__value">${userName}</div>
          </div>
        </div>
      </div>

      <p class="confirm-policy">${MASTER.cancellationPolicy}</p>

      <!-- Fallback-кнопка для браузера -->
      <div class="page-cta-wrap" id="page-cta" style="display:none">
        <button class="btn-primary" id="btn-confirm">Подтвердить запись</button>
      </div>
    </div>
  `;
}

function attachBookingConfirmHandlers(el) {
  const onConfirm = () => {
    TG.haptic.impact('medium');
    TG.mainBtn.setLoading(true);

    // Блокируем fallback-кнопку на время «отправки»
    const pageBtn = el.querySelector('#btn-confirm');
    if (pageBtn) { pageBtn.disabled = true; pageBtn.textContent = '...'; }

    // Имитация отправки на сервер
    setTimeout(() => {
      TG.mainBtn.setLoading(false);
      saveBooking();
      navigate('booking-success');
    }, 700);
  };

  if (window.Telegram?.WebApp?.initData) {
    TG.mainBtn.show('Подтвердить запись', onConfirm);
  } else {
    el.querySelector('#page-cta').style.display = 'block';
    el.querySelector('#btn-confirm').addEventListener('click', onConfirm);
  }
}

// ── ЭКРАН 5: УСПЕХ ────────────────────────────────────────────

function renderBookingSuccess() {
  const { service, date, time } = STATE.booking;

  return `
    <div class="success-screen">
      <div class="success-check">✓</div>
      <h1 class="success-title">Вы записаны!</h1>
      <p class="success-info">${formatDateLong(date)} · ${time}</p>
      <p class="success-info" style="margin-bottom:4px">${service?.name}</p>
      <p class="success-sub">
        ${MASTER.name} пришлёт напоминание<br>за 24 часа до визита
      </p>
      <button class="btn-secondary" id="btn-back-catalog">Вернуться к услугам</button>
    </div>
  `;
}

function attachSuccessHandlers(el) {
  // Haptic на успех
  TG.haptic.success();

  el.querySelector('#btn-back-catalog').addEventListener('click', () => {
    TG.haptic.impact('light');
    // Сбрасываем историю и возвращаемся в каталог
    STATE.history = [];
    STATE.booking = { service: null, date: null, time: null, endTime: null };
    navigateTab('catalog');
  });
}

// ── ЭКРАН 6: МОИ ЗАПИСИ ──────────────────────────────────────

function renderMyBookings() {
  const now = new Date();
  const upcoming = STATE.bookings.filter(b => new Date(b.date + 'T23:59:00') >= now);
  const past     = STATE.bookings.filter(b => new Date(b.date + 'T23:59:00') <  now);

  if (STATE.bookings.length === 0) {
    return `
      <div class="bookings-screen screen-content">
        <div class="empty-state">
          <div class="empty-state__icon">📅</div>
          <div class="empty-state__title">Вы ещё не записывались</div>
          <div class="empty-state__text">Запишитесь на любую услугу и она появится здесь</div>
          <button class="btn-primary" id="btn-to-catalog" style="width:auto; padding:0 32px">
            Перейти к услугам
          </button>
        </div>
      </div>
    `;
  }

  function bookingCardHTML(b, isPast) {
    const statusMap = {
      confirmed:  { cls: 'confirmed',  dot: '●', text: 'Подтверждено' },
      pending:    { cls: 'pending',    dot: '◌', text: 'Ожидает' },
      done:       { cls: 'done',       dot: '✓', text: 'Завершено' },
      cancelled:  { cls: 'cancelled',  dot: '✕', text: 'Отменено' },
    };
    const st = statusMap[b.status] || statusMap.confirmed;
    const actionBtn = isPast
      ? `<button class="btn-outline btn-outline--accent" data-rebooking="${b.serviceId}">Записаться снова</button>`
      : b.status !== 'cancelled'
        ? `<button class="btn-outline btn-outline--danger" data-cancel="${b.id}">Отменить</button>`
        : '';

    return `
      <div class="booking-card">
        <div class="booking-card__name">${b.serviceName}</div>
        <div class="booking-card__date">${formatDateLong(b.date)} · ${b.time}</div>
        <div class="booking-card__footer">
          <div class="status-badge status-badge--${st.cls}">${st.dot} ${st.text}</div>
          ${actionBtn}
        </div>
      </div>
    `;
  }

  const upcomingHTML = upcoming.length
    ? upcoming.map(b => bookingCardHTML(b, false)).join('')
    : `<p class="text-hint text-small" style="padding:8px 0 16px">Предстоящих записей нет</p>`;

  const pastHTML = past.length
    ? past.map(b => bookingCardHTML(b, true)).join('')
    : '';

  return `
    <div class="bookings-screen screen-content">
      <div class="section-title">Предстоящие</div>
      ${upcomingHTML}
      ${past.length ? `<div class="section-title">Прошедшие</div>${pastHTML}` : ''}
    </div>
  `;
}

function attachMyBookingsHandlers(el) {
  // Перейти к услугам (из пустого состояния)
  el.querySelector('#btn-to-catalog')?.addEventListener('click', () => {
    navigateTab('catalog');
  });

  // Отменить запись
  el.querySelectorAll('[data-cancel]').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic.impact('rigid');
      TG.confirm('Отменить запись?', (ok) => {
        if (!ok) return;
        const id = btn.dataset.cancel;
        const booking = STATE.bookings.find(b => b.id === id);
        if (booking) {
          booking.status = 'cancelled';
          saveBookings();
          // Перерендериваем экран
          navigateTab('my-bookings');
        }
      });
    });
  });

  // Записаться снова
  el.querySelectorAll('[data-rebooking]').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic.impact('light');
      const service = SERVICES.find(s => s.id === btn.dataset.rebooking);
      if (service) {
        STATE.service = service;
        STATE.booking = { service, date: null, time: null, endTime: null };
        navigate('booking-date');
      }
    });
  });
}

// ── ЭКРАН 7: О МАСТЕРЕ ───────────────────────────────────────

function renderAbout() {
  const hoursHTML = MASTER.hours.map(h => `
    <div class="hours-line">
      <span>${h.days}</span>
      <span>${h.time}</span>
    </div>
  `).join('');

  return `
    <div class="about-screen screen-content">
      <!-- Hero фото -->
      <div class="master-hero">💅</div>

      <div class="about-body">
        <h1 class="about-name">${MASTER.fullName}</h1>
        <p class="about-title">${MASTER.title} · ${MASTER.experience} лет опыта</p>

        <!-- Статы -->
        <div class="about-stats">
          <div class="stat-chip">
            <div class="stat-chip__value">★ ${MASTER.rating}</div>
            <div class="stat-chip__label">Рейтинг</div>
          </div>
          <div class="stat-chip">
            <div class="stat-chip__value">${MASTER.reviewCount}</div>
            <div class="stat-chip__label">Отзывов</div>
          </div>
          <div class="stat-chip">
            <div class="stat-chip__value">${MASTER.experience}</div>
            <div class="stat-chip__label">Лет опыта</div>
          </div>
        </div>

        <!-- О себе -->
        <p class="about-bio">${MASTER.bio}</p>

        <div class="divider"></div>

        <!-- Адрес и часы -->
        <div class="info-list">
          <div class="info-row">
            <div class="info-row__icon">📍</div>
            <div class="info-row__content">
              <div class="info-row__label">Адрес</div>
              <div class="info-row__value">${MASTER.city}, ${MASTER.address}</div>
              <span class="link-btn" id="btn-map">Открыть карту →</span>
            </div>
          </div>
          <div class="info-row">
            <div class="info-row__icon">🕐</div>
            <div class="info-row__content">
              <div class="info-row__label">Часы работы</div>
              <div class="info-row__hours">${hoursHTML}</div>
            </div>
          </div>
        </div>

        <!-- Кнопки действий -->
        <div class="about-action">
          <button class="btn-primary" id="btn-write">
            💬 Написать мастеру
          </button>
        </div>
        <div class="about-action">
          <button class="btn-secondary" id="btn-share">
            🔗 Поделиться с другом
          </button>
        </div>
      </div>
    </div>
  `;
}

function attachAboutHandlers(el) {
  el.querySelector('#btn-map')?.addEventListener('click', () => {
    TG.haptic.impact('light');
    TG.openLink(MASTER.mapUrl);
  });

  el.querySelector('#btn-write')?.addEventListener('click', () => {
    TG.haptic.impact('medium');
    TG.openTelegramChat(MASTER.telegramUsername);
  });

  el.querySelector('#btn-share')?.addEventListener('click', () => {
    TG.haptic.impact('light');
    const text = 'Записывайся к классному бьюти-мастеру — маникюр, педикюр, лэши и брови онлайн!';
    const url = `https://t.me/${MASTER.botUsername}`;
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(link);
    } else {
      window.open(link, '_blank');
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   7. КАРУСЕЛЬ
══════════════════════════════════════════════════════════════ */

function initCarousel(el) {
  const track = el.querySelector('#carousel-track');
  const dots  = el.querySelectorAll('.carousel__dot');
  if (!track || dots.length === 0) return;

  let current = 0;
  let startX = 0;
  let isDragging = false;

  function goTo(idx) {
    current = Math.max(0, Math.min(idx, dots.length - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    TG.haptic.selection();
  }

  // Touch-жесты
  track.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  track.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      goTo(diff > 0 ? current + 1 : current - 1);
    }
  });

  // Клик по точкам
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i));
  });
}

/* ══════════════════════════════════════════════════════════════
   8. ЗАПИСИ — localStorage
══════════════════════════════════════════════════════════════ */

/** Сохраняет текущую запись из STATE.booking */
function saveBooking() {
  const { service, date, time, endTime } = STATE.booking;
  const newBooking = {
    id: Date.now().toString(),
    serviceId: service.id,
    serviceName: service.name,
    date,
    time,
    endTime,
    price: service.price,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  STATE.bookings.unshift(newBooking);
  saveBookings();
}

/** Загружает записи из localStorage */
function loadBookings() {
  try {
    const raw = localStorage.getItem('beauty_bookings');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Сохраняет массив записей в localStorage */
function saveBookings() {
  try {
    localStorage.setItem('beauty_bookings', JSON.stringify(STATE.bookings));
  } catch {
    // Игнорируем ошибки localStorage
  }
}

/* ══════════════════════════════════════════════════════════════
   8б. ОФФЕР — показывается один раз при первом открытии
══════════════════════════════════════════════════════════════ */

const OFFER_SHOWN_KEY = 'beauty_offer_shown';

function showOffer() {
  // Показываем только один раз
  if (localStorage.getItem(OFFER_SHOWN_KEY)) return;

  const botLink = `https://t.me/${MASTER.botUsername}?start=from_app`;

  const overlay = document.createElement('div');
  overlay.className = 'offer-overlay';
  overlay.innerHTML = `
    <div class="offer-card">
      <span class="offer-emoji">🎁</span>
      <div class="offer-title">Скидка 15% на первую запись</div>
      <div class="offer-subtitle">
        Подпишитесь на бота —<br>получите промокод в личное сообщение
      </div>
      <div class="offer-bullets">
        <div class="offer-bullet">Напомним о записи за день</div>
        <div class="offer-bullet">Первыми узнаёте о свободных окошках</div>
        <div class="offer-bullet">Эксклюзивные акции для подписчиков</div>
      </div>
      <button class="offer-btn" id="offer-cta">Получить скидку 15%</button>
      <span class="offer-skip" id="offer-skip">Пропустить</span>
    </div>
  `;

  document.body.appendChild(overlay);

  function closeOffer() {
    localStorage.setItem(OFFER_SHOWN_KEY, '1');
    overlay.style.transition = 'opacity 0.22s ease';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 230);
  }

  overlay.querySelector('#offer-cta').addEventListener('click', () => {
    TG.haptic.impact('medium');
    TG.openLink(botLink);
    closeOffer();
  });

  overlay.querySelector('#offer-skip').addEventListener('click', () => {
    TG.haptic.selection();
    closeOffer();
  });

  // Тап по фону — закрыть
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      TG.haptic.selection();
      closeOffer();
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   9. ИНИЦИАЛИЗАЦИЯ
══════════════════════════════════════════════════════════════ */

function init() {
  // Инициализируем Telegram SDK
  TG.init();

  // Загружаем сохранённые записи
  STATE.bookings = loadBookings();

  // Обработчики нижней навигации
  bottomNav.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      TG.haptic.selection();
      navigateTab(item.dataset.screen);
    });
  });

  // Показываем скелетон на старте
  view.innerHTML = `<div class="screen">${skeletonCatalog()}</div>`;

  // Запускаем приложение: онбординг (первый раз) или сразу каталог
  setTimeout(() => {
    const isFirstLaunch = !localStorage.getItem(ONBOARDING_KEY);
    if (isFirstLaunch) {
      _render('onboarding', {}, 'forward');
    } else {
      _render('catalog', {}, 'forward');
      // Оффер показывается только в каталоге, не при онбординге
      setTimeout(showOffer, 600);
    }
  }, 600);
}

// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', init);
