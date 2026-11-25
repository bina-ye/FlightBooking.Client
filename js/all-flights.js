// קטלוג כל הטיסות — GET /api/flights/catalog
const PAGE_SIZE = 9;

document.addEventListener('DOMContentLoaded', () => {
  hideMessage('message');

  // התאריך המינימלי לבחירה = היום (לפי שעון המשתמש)
  const minDate = toIsoDate(new Date());
  const fromEl = document.getElementById('filterFrom');
  const toEl = document.getElementById('filterTo');

  if (fromEl) fromEl.min = minDate;
  if (toEl) toEl.min = minDate;

  // תאריך הסיום לא יכול להיות לפני תאריך ההתחלה
  fromEl?.addEventListener('change', () => {
    if (!toEl) return;
    toEl.min = fromEl.value || minDate;
    if (toEl.value && toEl.value < toEl.min) toEl.value = '';
  });

  loadCatalog(1);

  document.getElementById('filterBtn')?.addEventListener('click', () => loadCatalog(1));
  document.getElementById('clearFilterBtn')?.addEventListener('click', () => {
    ['filterOrigin', 'filterDestination', 'filterFrom', 'filterTo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (toEl) toEl.min = minDate;
    loadCatalog(1);
  });

  // Enter בכל שדה סינון מפעיל חיפוש
  ['filterOrigin', 'filterDestination', 'filterFrom', 'filterTo'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') loadCatalog(1);
    });
  });
});

/** מחזיר את ערכי הסינון, זורק שגיאה אם הערכים אינם חוקיים */
function buildCatalogParams(page) {
  const params = new URLSearchParams({ pageNumber: page, pageSize: PAGE_SIZE });

  const origin = document.getElementById('filterOrigin')?.value.trim();
  const destination = document.getElementById('filterDestination')?.value.trim();
  const fromDate = document.getElementById('filterFrom')?.value;
  const toDate = document.getElementById('filterTo')?.value;

  const today = toIsoDate(new Date());

  if (fromDate && fromDate < today) {
    throw new Error('לא ניתן לסנן מתאריך שכבר עבר.');
  }
  if (toDate && toDate < today) {
    throw new Error('תאריך הסיום לא יכול להיות בעבר.');
  }
  if (fromDate && toDate && toDate < fromDate) {
    throw new Error('תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.');
  }

  if (origin) params.set('originCode', origin.toUpperCase());
  if (destination) params.set('destinationCode', destination.toUpperCase());
  if (fromDate) params.set('fromDate', fromDate);
  if (toDate) params.set('toDate', toDate);

  return { params, hasFilter: Boolean(origin || destination || fromDate || toDate) };
}

async function loadCatalog(page) {
  const list = document.getElementById('flightsList');
  const pagination = document.getElementById('pagination');
  const meta = document.getElementById('flightsMeta');

  hideMessage('message');

  // שלדים בגובה הכרטיסים — כדי שכשהתוצאות מגיעות העמוד לא "יקפוץ"
  const skeletons = Array.from({ length: PAGE_SIZE }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <span class="skeleton-bar is-head"></span>
      <span class="skeleton-box"></span>
      <span class="skeleton-bar is-line"></span>
      <span class="skeleton-bar is-foot"></span>
    </div>`).join('');
  list.innerHTML = skeletons;
  pagination.innerHTML = '';
  meta.textContent = 'טוען טיסות…';

  try {
    // apiFetch מוסיף את API_BASE בעצמו — לכן נתיב יחסי בלבד
    const { params, hasFilter } = buildCatalogParams(page);
    // עם cache: 'no-store' — כל בקשה פוגעת בשרת. ב-Render השרת "נרדם", ולכן
    // הבקשה הראשונה עשויה לקחת 30–60 שניות. קיצוב כדי שלא ייראה כאילו הדף "תקוע/מתרענן".
    const data = await apiFetch(`/flights/catalog?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(70000)
    });

    const items = Array.isArray(data?.items) ? data.items : [];

    if (items.length === 0) {
      meta.textContent = 'לא נמצאו טיסות.';
      list.innerHTML = hasFilter
        ? '<div class="empty">אין טיסות שמתאימות לסינון. נסו לנקות את הסינון.</div>'
        : '<div class="empty">אין טיסות להצגה כרגע.</div>';
      return;
    }

    const totalPages = data.totalPages ?? 1;
    meta.textContent = `נמצאו ${data.totalCount} טיסות · עמוד ${data.pageNumber ?? page} מתוך ${totalPages}`;
    list.innerHTML = items.map(renderFlightCard).join('');
    renderPagination(data, page);
  } catch (err) {
    meta.textContent = '';
    list.innerHTML = '';
    // כשל רשת / timeout — מסר ברור עם כפתור ניסיון חוזר (בלי לרענן את העמוד)
    const isNetwork = err?.status === 0
      || err?.name === 'TimeoutError'
      || err?.name === 'AbortError'
      || err?.name === 'TypeError';
    const text = err?.status === 0
      ? err.message                                  // "אין חיבור לשרת ה-API…" — הודעה מדויקת מ-api.js
      : isNetwork
        ? 'השרת לא הגיב בזמן. נסו שוב בעוד רגע.'
        : (err.message || 'לא ניתן לטעון את רשימת הטיסות.');
    showMessage('message', text, 'error');

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-outline';
    retry.textContent = 'ניסיון חוזר';
    retry.addEventListener('click', () => loadCatalog(page));
    document.getElementById('message')?.appendChild(retry);
  }
}

function renderFlightCard(flight) {
  const departure = formatDateTime(flight.departureTime);
  const arrival = formatDateTime(flight.arrivalTime);

  const priceNumber = Number(flight.price);
  const price = Number.isFinite(priceNumber)
    ? priceNumber.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
    : '';

  const seats = Number(flight.availableSeatsCount) || 0;
  const soldOut = seats === 0;

  return `
    <article class="flight-card">
      <div class="flight-head">
        <span class="flight-number">${esc(flight.flightNumber)}</span>
        <span class="flight-price">${price}</span>
      </div>

      <div class="flight-route">
        <div class="route-side">
          <span class="route-code">${esc(flight.originCode)}</span>
          <span class="route-city">${esc(flight.originCity)}</span>
          <span class="route-time">${departure}</span>
        </div>
        <div class="route-arrow">←</div>
        <div class="route-side">
          <span class="route-code">${esc(flight.destinationCode)}</span>
          <span class="route-city">${esc(flight.destinationCity)}</span>
          <span class="route-time">${arrival}</span>
        </div>
      </div>

      <div class="flight-foot">
        <span class="seats ${soldOut ? 'seats-none' : ''}">
          ${soldOut ? 'אזל המקום' : `${seats} מקומות פנויים`}
        </span>
        <a class="btn btn-primary ${soldOut ? 'btn-disabled' : ''}"
           href="${soldOut ? '#' : `seats.html?flightId=${encodeURIComponent(flight.id)}`}"
           ${soldOut ? 'aria-disabled="true" tabindex="-1"' : ''}>
          בחירת מושב
        </a>
      </div>
    </article>
  `;
}

function renderPagination(data, fallbackPage) {
  const pagination = document.getElementById('pagination');
  const pageNumber = data.pageNumber ?? fallbackPage;
  const totalPages = data.totalPages ?? 1;

  // שומרים גובה קבוע לעימוד — שלא ייעלם ויחזור (ומושך את העמוד)
  pagination.innerHTML = '';
  if (totalPages <= 1) return;

  const hasPrevious = data.hasPrevious ?? pageNumber > 1;
  const hasNext = data.hasNext ?? pageNumber < totalPages;

  pagination.innerHTML = `
    <button class="btn btn-outline" ${hasPrevious ? '' : 'disabled'} data-page="${pageNumber - 1}">
      הקודם
    </button>
    <span class="page-indicator">עמוד ${pageNumber} מתוך ${totalPages}</span>
    <button class="btn btn-outline" ${hasNext ? '' : 'disabled'} data-page="${pageNumber + 1}">
      הבא
    </button>
  `;

  pagination.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = Number(btn.dataset.page);
      if (!target || target < 1 || target > totalPages) return;
      loadCatalog(target);
      // גלילה מיידית (לא חלקה) — גלילה אנימטיבית נראית כמו "העמוד זז לבד"
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  });
}

function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = '';
  el.className = 'message hidden';
  el.style.display = 'none';
}

/** ממיר Date למחרוזת YYYY-MM-DD לפי השעון המקומי (לא UTC) */
function toIsoDate(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  let normalized = String(value);
  // DateTime ללא סיומת אזור זמן מגיע מהשרת כ-UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(normalized)) {
    normalized += 'Z';
  }

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(value) {
  const d = parseServerDate(value);
  if (!d) return value ?? '';
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

