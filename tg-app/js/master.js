/**
 * master.js — Панель мастера (М1, М3, М4)
 *
 * Экраны:
 *   М1  master-panel    — расписание на день (список записей)
 *   М3  master-schedule — управление графиком работы
 *   М4  master-settings — настройки профиля мастера
 *
 * Все функции — глобальные, вызываются из app.js через роутер.
 * Требует: TG, STATE, navigate, navigateTab, formatDateLong,
 *          formatDateShort, formatDayPill, formatDuration, formatPrice
 */

'use strict';

/* ── Текущая выбранная дата в панели мастера ───────────────── */
let _masterDate = new Date().toISOString().slice(0, 10);

/* ── Fetch с заголовком initData ───────────────────────────── */
function masterFetch(url, opts = {}) {
  const initData = window.Telegram?.WebApp?.initData || '';
  return fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(opts.headers || {}),
    },
  });
}

/* ══════════════════════════════════════════════════════════════
   М1: РАСПИСАНИЕ — список записей на выбранную дату
══════════════════════════════════════════════════════════════ */

function renderMasterPanel() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const daysHTML = dates.map(dateStr => {
    const { dayName, dayNum } = formatDayPill(dateStr);
    return `
      <button class="day-pill ${dateStr === _masterDate ? 'selected' : ''}" data-date="${dateStr}">
        <span class="day-pill__name">${dayName}</span>
        <span class="day-pill__num">${dayNum}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="screen-content master-panel">

      <!-- Шапка с переходами -->
      <div class="master-header-nav">
        <div class="master-header-nav__title">🔧 Панель мастера</div>
        <div class="master-header-nav__links">
          <button class="master-link active">📅 Записи</button>
          <button class="master-link" id="btn-to-schedule">🗓 График</button>
          <button class="master-link" id="btn-to-settings">⚙️ Профиль</button>
        </div>
      </div>

      <!-- Выбор даты -->
      <div class="date-picker" id="master-date-picker">
        ${daysHTML}
      </div>

      <!-- Список записей -->
      <div id="master-bookings-list" class="master-bookings-list">
        <div class="slots-empty">⏳ Загрузка...</div>
      </div>

    </div>
  `;
}

function _masterBookingCard(b) {
  const statusMap = {
    confirmed: { cls: 'confirmed',  dot: '●', text: 'Подтверждено' },
    done:      { cls: 'done',       dot: '✓', text: 'Завершено' },
    cancelled: { cls: 'cancelled',  dot: '✕', text: 'Отменено' },
    no_show:   { cls: 'cancelled',  dot: '✕', text: 'Не пришёл' },
  };
  const st = statusMap[b.status] || statusMap.confirmed;
  const clientName = [b.telegram_first_name, b.telegram_last_name].filter(Boolean).join(' ');
  const username = b.telegram_username ? ` @${b.telegram_username}` : '';

  const actions = b.status === 'confirmed' ? `
    <div class="master-card-actions">
      <button class="master-action-btn master-action-btn--done" data-id="${b.id}" data-action="done">
        Завершено
      </button>
      <button class="master-action-btn master-action-btn--noshow" data-id="${b.id}" data-action="no_show">
        Не пришёл
      </button>
      <button class="master-action-btn master-action-btn--cancel" data-id="${b.id}" data-action="cancelled">
        Отменить
      </button>
    </div>
  ` : '';

  return `
    <div class="master-booking-card master-booking-card--${st.cls}" data-id="${b.id}">
      <div class="master-booking-card__time">${b.start_time} — ${b.end_time}</div>
      <div class="master-booking-card__service">${b.service_name}</div>
      <div class="master-booking-card__client">${clientName}${username}</div>
      <div class="master-booking-card__footer">
        <div class="status-badge status-badge--${st.cls}">${st.dot} ${st.text}</div>
        <div class="master-booking-card__price">${formatPrice(b.service_price)}</div>
      </div>
      ${actions}
    </div>
  `;
}

async function _loadMasterBookings(el) {
  const list = el.querySelector('#master-bookings-list');
  if (!list) return;

  try {
    const data = await masterFetch(`/api/master/bookings?date=${_masterDate}`)
      .then(r => r.json());

    if (!Array.isArray(data) || data.length === 0) {
      list.innerHTML = `<div class="slots-empty">На эту дату записей нет</div>`;
      return;
    }
    list.innerHTML = data.map(_masterBookingCard).join('');
    _attachMasterBookingActions(list);
  } catch {
    list.innerHTML = `<div class="slots-empty">Ошибка загрузки. Откройте в Telegram.</div>`;
  }
}

function _attachMasterBookingActions(container) {
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      TG.haptic.impact('medium');
      const id     = btn.dataset.id;
      const action = btn.dataset.action;

      const labels = { done: 'Отметить «Завершено»?', no_show: 'Клиент не пришёл?', cancelled: 'Отменить запись?' };
      TG.confirm(labels[action], async (ok) => {
        if (!ok) return;
        try {
          await masterFetch(`/api/master/bookings?id=${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: action }),
          });
          TG.haptic.success();
          // Перезагружаем список
          const list = document.getElementById('master-bookings-list');
          if (list) {
            list.innerHTML = `<div class="slots-empty">⏳ Загрузка...</div>`;
            const el = list.closest('.screen');
            await _loadMasterBookings(el || document);
          }
        } catch {
          TG.haptic.error();
          TG.alert('Ошибка. Попробуйте ещё раз.');
        }
      });
    });
  });
}

function attachMasterPanelHandlers(el) {
  // Переходы к другим экранам панели
  el.querySelector('#btn-to-schedule')?.addEventListener('click', () => {
    TG.haptic.impact('light');
    navigate('master-schedule');
  });
  el.querySelector('#btn-to-settings')?.addEventListener('click', () => {
    TG.haptic.impact('light');
    navigate('master-settings');
  });

  // Выбор даты
  el.querySelectorAll('.day-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      TG.haptic.selection();
      _masterDate = btn.dataset.date;

      el.querySelectorAll('.day-pill').forEach(b =>
        b.classList.toggle('selected', b.dataset.date === _masterDate)
      );
      const list = el.querySelector('#master-bookings-list');
      if (list) list.innerHTML = `<div class="slots-empty">⏳ Загрузка...</div>`;
      await _loadMasterBookings(el);
    });
  });

  // Загружаем записи для текущей даты
  _loadMasterBookings(el);
}

/* ══════════════════════════════════════════════════════════════
   М3: ГРАФИК РАБОТЫ
══════════════════════════════════════════════════════════════ */

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // пн..вс

function renderMasterSchedule() {
  return `
    <div class="screen-content master-schedule">
      <div class="section-title">График работы</div>

      <!-- Еженедельный шаблон -->
      <div class="master-schedule-section">
        <div class="master-schedule-section__label">Еженедельный шаблон</div>
        <div id="weekly-schedule" class="weekly-schedule">
          <div class="slots-empty">⏳ Загрузка...</div>
        </div>
      </div>

      <!-- Исключения для конкретных дат -->
      <div class="master-schedule-section">
        <div class="master-schedule-section__label">Исключения (конкретные даты)</div>
        <div id="date-overrides" class="date-overrides">
          <div class="slots-empty">⏳ Загрузка...</div>
        </div>
        <button class="btn-secondary" id="btn-add-override" style="margin-top:12px">
          + Добавить исключение
        </button>
      </div>

      <!-- Форма добавления исключения (скрыта) -->
      <div class="master-override-form" id="override-form" style="display:none">
        <div class="form-field">
          <label class="form-label">Дата</label>
          <input type="date" class="form-input" id="override-date"
                 min="${new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="form-field">
          <label class="form-label">Тип дня</label>
          <select class="form-input" id="override-type">
            <option value="off">Выходной</option>
            <option value="work">Рабочий день (особый)</option>
          </select>
        </div>
        <div id="override-times" style="display:none">
          <div class="form-row-2">
            <div class="form-field">
              <label class="form-label">Начало</label>
              <input type="time" class="form-input" id="override-start" value="10:00">
            </div>
            <div class="form-field">
              <label class="form-label">Конец</label>
              <input type="time" class="form-input" id="override-end" value="18:00">
            </div>
          </div>
        </div>
        <div class="form-row-2">
          <button class="btn-secondary" id="btn-cancel-override">Отмена</button>
          <button class="btn-primary" id="btn-save-override">Сохранить</button>
        </div>
      </div>

    </div>
  `;
}

function _weeklyRowHTML(row) {
  const dayName = DAY_NAMES[row.day_of_week];
  if (!row.is_working) {
    return `
      <div class="schedule-row" data-id="${row.id}" data-day="${row.day_of_week}">
        <div class="schedule-row__day">${dayName}</div>
        <div class="schedule-row__status off">Выходной</div>
        <button class="schedule-row__edit" data-edit="${row.id}">Изменить</button>
      </div>
      <div class="schedule-edit-form" id="edit-${row.id}" style="display:none"
           data-id="${row.id}">
        ${_dayEditFormHTML(row)}
      </div>
    `;
  }
  const breakStr = row.break_start
    ? ` · перерыв ${row.break_start.slice(0,5)}–${row.break_end.slice(0,5)}`
    : '';
  return `
    <div class="schedule-row" data-id="${row.id}" data-day="${row.day_of_week}">
      <div class="schedule-row__day">${dayName}</div>
      <div class="schedule-row__status on">${row.start_time.slice(0,5)} – ${row.end_time.slice(0,5)}${breakStr}</div>
      <button class="schedule-row__edit" data-edit="${row.id}">Изменить</button>
    </div>
    <div class="schedule-edit-form" id="edit-${row.id}" style="display:none"
         data-id="${row.id}">
      ${_dayEditFormHTML(row)}
    </div>
  `;
}

function _dayEditFormHTML(row) {
  const isWorking = row.is_working;
  return `
    <div class="form-field">
      <label class="form-label">
        <input type="checkbox" id="chk-working-${row.id}" ${isWorking ? 'checked' : ''}>
        Рабочий день
      </label>
    </div>
    <div class="day-times-fields" style="display:${isWorking ? 'block' : 'none'}">
      <div class="form-row-2">
        <div class="form-field">
          <label class="form-label">Начало</label>
          <input type="time" class="form-input" id="start-${row.id}"
                 value="${row.start_time ? row.start_time.slice(0,5) : '10:00'}">
        </div>
        <div class="form-field">
          <label class="form-label">Конец</label>
          <input type="time" class="form-input" id="end-${row.id}"
                 value="${row.end_time ? row.end_time.slice(0,5) : '20:00'}">
        </div>
      </div>
      <div class="form-field">
        <label class="form-label">
          <input type="checkbox" id="chk-break-${row.id}" ${row.break_start ? 'checked' : ''}>
          Перерыв
        </label>
      </div>
      <div class="break-fields" style="display:${row.break_start ? 'block' : 'none'}">
        <div class="form-row-2">
          <div class="form-field">
            <label class="form-label">Начало</label>
            <input type="time" class="form-input" id="break-start-${row.id}"
                   value="${row.break_start ? row.break_start.slice(0,5) : '13:00'}">
          </div>
          <div class="form-field">
            <label class="form-label">Конец</label>
            <input type="time" class="form-input" id="break-end-${row.id}"
                   value="${row.break_end ? row.break_end.slice(0,5) : '14:00'}">
          </div>
        </div>
      </div>
    </div>
    <button class="btn-primary" data-save-day="${row.id}" style="margin-top:8px">Сохранить</button>
  `;
}

function _overrideItemHTML(row) {
  const dateLabel = row.specific_date;
  const status = row.is_working
    ? `${row.start_time.slice(0,5)} – ${row.end_time.slice(0,5)}`
    : 'Выходной';
  return `
    <div class="date-override-item">
      <div>
        <div class="date-override-item__date">${dateLabel}</div>
        <div class="date-override-item__status">${status}</div>
      </div>
      <button class="date-override-item__del" data-del="${row.id}">✕</button>
    </div>
  `;
}

async function _loadSchedule(el) {
  try {
    const schedule = await masterFetch('/api/master/schedule').then(r => r.json());

    // Еженедельный шаблон
    const weekly = schedule.filter(r => r.day_of_week !== null && r.day_of_week !== undefined);
    const weeklyEl = el.querySelector('#weekly-schedule');
    if (weeklyEl) {
      weeklyEl.innerHTML = DAY_ORDER
        .map(d => weekly.find(r => r.day_of_week === d))
        .filter(Boolean)
        .map(_weeklyRowHTML)
        .join('');
      _attachWeeklyHandlers(weeklyEl);
    }

    // Исключения
    const specific = schedule
      .filter(r => r.specific_date)
      .sort((a, b) => a.specific_date.localeCompare(b.specific_date));
    const overridesEl = el.querySelector('#date-overrides');
    if (overridesEl) {
      overridesEl.innerHTML = specific.length
        ? specific.map(_overrideItemHTML).join('')
        : `<div class="text-hint text-small">Исключений нет</div>`;
      _attachOverrideDeleteHandlers(overridesEl, el);
    }
  } catch {
    el.querySelector('#weekly-schedule').innerHTML =
      `<div class="slots-empty">Ошибка загрузки. Откройте в Telegram.</div>`;
  }
}

function _attachWeeklyHandlers(container) {
  // Кнопка «Изменить» — показывает/скрывает форму
  container.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.haptic.selection();
      const formEl = container.querySelector(`#edit-${btn.dataset.edit}`);
      if (!formEl) return;
      const isOpen = formEl.style.display !== 'none';
      formEl.style.display = isOpen ? 'none' : 'block';
    });
  });

  // Чекбокс «Рабочий день»
  container.querySelectorAll('[id^="chk-working-"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.id.replace('chk-working-', '');
      const timesEl = chk.closest('.schedule-edit-form')?.querySelector('.day-times-fields');
      if (timesEl) timesEl.style.display = chk.checked ? 'block' : 'none';
    });
  });

  // Чекбокс «Перерыв»
  container.querySelectorAll('[id^="chk-break-"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const breakEl = chk.closest('.schedule-edit-form')?.querySelector('.break-fields');
      if (breakEl) breakEl.style.display = chk.checked ? 'block' : 'none';
    });
  });

  // Кнопка «Сохранить» для дня
  container.querySelectorAll('[data-save-day]').forEach(btn => {
    btn.addEventListener('click', async () => {
      TG.haptic.impact('medium');
      const id = btn.dataset.saveDay;
      const form = btn.closest('.schedule-edit-form');

      const isWorking = form.querySelector(`#chk-working-${id}`)?.checked ?? false;
      const hasBreak  = form.querySelector(`#chk-break-${id}`)?.checked ?? false;

      const body = { is_working: isWorking };
      if (isWorking) {
        body.start_time  = form.querySelector(`#start-${id}`)?.value || '10:00';
        body.end_time    = form.querySelector(`#end-${id}`)?.value || '20:00';
        body.break_start = hasBreak ? (form.querySelector(`#break-start-${id}`)?.value || '13:00') : null;
        body.break_end   = hasBreak ? (form.querySelector(`#break-end-${id}`)?.value || '14:00')   : null;
      } else {
        body.start_time = null;
        body.end_time   = null;
        body.break_start = null;
        body.break_end   = null;
      }

      try {
        btn.disabled = true;
        btn.textContent = '...';
        const patchResp = await masterFetch(`/api/master/schedule?id=${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        if (!patchResp.ok) {
          const errData = await patchResp.json().catch(() => ({}));
          throw new Error(errData.error || `Ошибка ${patchResp.status}`);
        }
        TG.haptic.success();
        form.style.display = 'none';
        // Обновляем отображение строки
        const rowEl = container.querySelector(`.schedule-row[data-id="${id}"]`);
        if (rowEl) {
          const statusEl = rowEl.querySelector('.schedule-row__status');
          if (statusEl) {
            if (!isWorking) {
              statusEl.className = 'schedule-row__status off';
              statusEl.textContent = 'Выходной';
            } else {
              statusEl.className = 'schedule-row__status on';
              const breakStr = hasBreak
                ? ` · перерыв ${body.break_start}–${body.break_end}`
                : '';
              statusEl.textContent = `${body.start_time} – ${body.end_time}${breakStr}`;
            }
          }
        }
      } catch {
        TG.haptic.error();
        TG.alert('Ошибка сохранения. Попробуйте ещё раз.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить';
      }
    });
  });
}

function _attachOverrideDeleteHandlers(container, parentEl) {
  container.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      TG.confirm('Удалить исключение?', async (ok) => {
        if (!ok) return;
        try {
          await masterFetch(`/api/master/schedule?id=${btn.dataset.del}`, { method: 'DELETE' });
          TG.haptic.success();
          await _loadSchedule(parentEl);
        } catch {
          TG.alert('Ошибка удаления.');
        }
      });
    });
  });
}

function attachMasterScheduleHandlers(el) {
  // Кнопка «Добавить исключение»
  el.querySelector('#btn-add-override')?.addEventListener('click', () => {
    TG.haptic.impact('light');
    const form = el.querySelector('#override-form');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  });

  // Тип дня — показать/скрыть времена
  el.querySelector('#override-type')?.addEventListener('change', function() {
    const timesEl = el.querySelector('#override-times');
    if (timesEl) timesEl.style.display = this.value === 'work' ? 'block' : 'none';
  });

  // Отмена формы
  el.querySelector('#btn-cancel-override')?.addEventListener('click', () => {
    TG.haptic.selection();
    const form = el.querySelector('#override-form');
    if (form) form.style.display = 'none';
  });

  // Сохранение исключения
  el.querySelector('#btn-save-override')?.addEventListener('click', async () => {
    TG.haptic.impact('medium');
    const date = el.querySelector('#override-date')?.value;
    const type = el.querySelector('#override-type')?.value;
    if (!date) { TG.alert('Выберите дату'); return; }

    const isWorking = type === 'work';
    const body = {
      specific_date: date,
      day_of_week:   null,
      is_working:    isWorking,
      start_time:    isWorking ? (el.querySelector('#override-start')?.value || '10:00') : null,
      end_time:      isWorking ? (el.querySelector('#override-end')?.value   || '18:00') : null,
      break_start:   null,
      break_end:     null,
    };

    try {
      const btn = el.querySelector('#btn-save-override');
      btn.disabled = true;
      btn.textContent = '...';
      const resp = await masterFetch('/api/master/schedule', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Ошибка ${resp.status}`);
      }
      TG.haptic.success();
      el.querySelector('#override-form').style.display = 'none';
      await _loadSchedule(el);
    } catch {
      TG.haptic.error();
      TG.alert('Ошибка. Возможно, на эту дату уже есть исключение.');
    } finally {
      const btn = el.querySelector('#btn-save-override');
      if (btn) { btn.disabled = false; btn.textContent = 'Сохранить'; }
    }
  });

  // Загружаем данные
  _loadSchedule(el);
}

/* ══════════════════════════════════════════════════════════════
   М4: НАСТРОЙКИ ПРОФИЛЯ
══════════════════════════════════════════════════════════════ */

function renderMasterSettings() {
  return `
    <div class="screen-content master-settings">
      <div class="section-title">Настройки профиля</div>

      <div id="settings-form-wrap">
        <div class="slots-empty">⏳ Загрузка...</div>
      </div>

      <!-- Fallback кнопка для браузера -->
      <div class="page-cta-wrap" id="settings-cta" style="display:none">
        <button class="btn-primary" id="btn-save-settings">Сохранить</button>
      </div>
    </div>
  `;
}

function _settingsFormHTML(s) {
  const field = (label, name, value, type = 'text') => `
    <div class="form-field">
      <label class="form-label">${label}</label>
      <input type="${type}" class="form-input" name="${name}" value="${_esc(value || '')}">
    </div>
  `;
  const textarea = (label, name, value) => `
    <div class="form-field">
      <label class="form-label">${label}</label>
      <textarea class="form-input form-textarea" name="${name}" rows="3">${_esc(value || '')}</textarea>
    </div>
  `;

  return `
    <form id="settings-form">
      ${field('Короткое имя (в шапке)', 'name', s.name || s.short_name)}
      ${field('Полное имя', 'full_name', s.full_name)}
      ${field('Должность / специализация', 'title', s.title)}
      ${field('Лет опыта', 'experience', s.experience || s.experience_years, 'number')}
      ${textarea('О себе', 'bio', s.bio)}
      ${field('Город', 'city', s.city)}
      ${field('Адрес', 'address', s.address)}
      ${field('Ссылка на карту', 'map_url', s.map_url, 'url')}
      ${field('Telegram username (без @)', 'telegram_username', s.telegram_username)}
      ${field('Username бота (без @)', 'bot_username', s.bot_username)}
      ${textarea('Политика отмены', 'cancellation_policy', s.cancellation_policy)}
    </form>
  `;
}

function _esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function _loadSettings(el) {
  const wrap = el.querySelector('#settings-form-wrap');
  try {
    const s = await masterFetch('/api/master/settings').then(r => r.json());
    if (s.error) throw new Error(s.error);
    wrap.innerHTML = _settingsFormHTML(s);
    _setupSettingsSave(el, s.id);
  } catch (err) {
    wrap.innerHTML = `<div class="slots-empty">Ошибка: ${_esc(err.message)}</div>`;
  }
}

function _setupSettingsSave(el, _id) {
  const inTg = !!window.Telegram?.WebApp?.initData;

  const doSave = async () => {
    TG.haptic.impact('medium');
    TG.mainBtn.setLoading(true);

    const form = el.querySelector('#settings-form');
    if (!form) { TG.mainBtn.setLoading(false); return; }

    const formData = new FormData(form);
    const body = {};
    formData.forEach((v, k) => { body[k] = v || null; });

    try {
      await masterFetch('/api/master/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      TG.haptic.success();
      TG.alert('Настройки сохранены!');
      // Обновляем STATE.master
      await loadCatalog();
    } catch {
      TG.haptic.error();
      TG.alert('Ошибка сохранения.');
    } finally {
      TG.mainBtn.setLoading(false);
      const pgBtn = el.querySelector('#btn-save-settings');
      if (pgBtn) { pgBtn.disabled = false; pgBtn.textContent = 'Сохранить'; }
    }
  };

  if (inTg) {
    TG.mainBtn.show('Сохранить', doSave);
  } else {
    const cta = el.querySelector('#settings-cta');
    const btn = el.querySelector('#btn-save-settings');
    if (cta) cta.style.display = 'block';
    if (btn) btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      await doSave();
    });
  }
}

function attachMasterSettingsHandlers(el) {
  _loadSettings(el);
}
