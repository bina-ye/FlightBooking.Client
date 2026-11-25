/* ============================================================
   כל ההזמנות — למנהל בלבד
   ============================================================ */

const bookingsList = document.getElementById("bookingsList");
const paginationEl = document.getElementById("pagination");
const bookingsMessage = document.getElementById("bookingsMessage");
const bookingsMeta = document.getElementById("bookingsMeta");
const adminNotice = document.getElementById("adminNotice");

let currentPage = 1;
const pageSize = 12;

/* ---------- פורמט ---------- */

function formatDateTime(isoString) {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleString("he-IL", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
}

function formatPrice(amount) {
    return new Intl.NumberFormat("he-IL", {
        style: "currency", currency: "ILS", maximumFractionDigits: 0
    }).format(amount || 0);
}

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

const STATUS_LABELS = {
    Pending: "ממתין",
    Confirmed: "מאושר",
    Cancelled: "מבוטל",
    Completed: "הושלם"
};

function statusLabel(raw) {
    return STATUS_LABELS[raw] || raw || "—";
}

/* ---------- כרטיס הזמנה ---------- */

function renderBooking(item) {
    const card = document.createElement("article");
    card.className = "flight-card";

    const isCancelled = String(item.status || "").toLowerCase() === "cancelled";

    card.innerHTML = `
        <div class="flight-main">
            <div class="flight-number">קוד הזמנה: ${escapeHtml(item.bookingReference)}</div>
            <div class="flight-route">
                <span class="badge">${escapeHtml(statusLabel(item.status))}</span>
            </div>
            <div class="flight-time">
                <span><strong>${escapeHtml(item.passengerFullName || "—")}</strong></span>
                <span>${escapeHtml(item.customerEmail || "—")}</span>
                <span>נוצרה: ${formatDateTime(item.createdAt)}</span>
                <span>המראה: ${formatDateTime(item.firstDepartureTime)}</span>
                <span>${item.seatsCount ?? 0} מושבים · ${item.flightsCount ?? 0} טיסות</span>
            </div>
        </div>
        <div class="flight-side">
            <div class="flight-price">${formatPrice(item.totalAmount)}</div>
            <a class="btn btn-secondary" href="booking-details.html?id=${encodeURIComponent(item.id)}">פרטים</a>
            <div class="booking-actions">
                <button type="button" class="btn btn-danger"
                        onclick="cancelBookingRow(${Number(item.id)})"
                        ${isCancelled ? "disabled" : ""}>ביטול</button>
            </div>
        </div>
    `;

    return card;
}

/* ---------- עימוד ---------- */

function renderPagination(pageNumber, totalPages) {
    paginationEl.innerHTML = "";
    if (totalPages <= 1) return;

    const add = (label, page, disabled = false) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-page" + (page === pageNumber ? " active" : "");
        btn.textContent = label;
        btn.disabled = disabled;
        btn.addEventListener("click", () => { currentPage = page; loadAllBookings(); });
        paginationEl.appendChild(btn);
    };

    add("הקודם", pageNumber - 1, pageNumber <= 1);
    for (let p = 1; p <= totalPages; p++) add(String(p), p, p === pageNumber);
    add("הבא", pageNumber + 1, pageNumber >= totalPages);
}

/* ---------- טעינה ---------- */

async function loadAllBookings() {
    showMessage(bookingsMessage, "");

    // שלדים — כדי שהעמוד לא "יקפוץ" בזמן הטעינה
    bookingsList.innerHTML = Array.from({ length: 6 }, () => `
        <div class="skeleton-card" aria-hidden="true">
            <span class="skeleton-bar is-head"></span>
            <span class="skeleton-box"></span>
            <span class="skeleton-bar is-line"></span>
        </div>`).join("");
    paginationEl.innerHTML = "";
    bookingsMeta.textContent = "טוען הזמנות…";

    try {
        const data = await apiFetch(
            `/bookings/all?pageNumber=${currentPage}&pageSize=${pageSize}`,
            { cache: "no-store" });

        const items = data.items || [];
        bookingsList.innerHTML = "";

        if (items.length === 0) {
            bookingsMeta.textContent = "";
            bookingsList.innerHTML =
                '<div class="message message-info" style="display:block">עדיין לא בוצעו הזמנות במערכת.</div>';
            return;
        }

        const totalPages = data.totalPages || Math.ceil((data.totalCount || items.length) / pageSize);
        bookingsMeta.textContent =
            `${data.totalCount ?? items.length} הזמנות · עמוד ${currentPage} מתוך ${totalPages}`;

        items.forEach(item => bookingsList.appendChild(renderBooking(item)));
        renderPagination(currentPage, totalPages);

    } catch (error) {
        bookingsMeta.textContent = "";
        bookingsList.innerHTML = "";

        if (error.status === 403) {
            adminNotice.style.display = "block";
            showMessage(bookingsMessage, "הדף זמין למנהל בלבד.");
            bookingsMeta.textContent = "אין הרשאה";
        } else {
            showMessage(bookingsMessage,
                error.status === 0
                    ? error.message
                    : (error.message || "לא ניתן לטעון את ההזמנות."));
        }
    }
}

/* ---------- ביטול ---------- */

async function cancelBookingRow(id) {
    const ok = confirm("לבטל את ההזמנה? הפעולה אינה ניתנת לשחזור והמושבים ישוחררו.");
    if (!ok) return;

    try {
        await apiFetch(`/bookings/${id}`, { method: "DELETE" });
        showMessage(bookingsMessage, "ההזמנה בוטלה בהצלחה", "success");
        await loadAllBookings();
    } catch (error) {
        showMessage(bookingsMessage, error.message);
    }
}

/* ---------- אתחול ---------- */

(function init() {
    // הסתרת הדף ממי שאינו מנהל — לפני כל קריאה לשרת
    const role = (() => {
        try {
            const payload = JSON.parse(atob(getToken().split(".")[1]));
            return payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
        } catch {
            return null;
        }
    })();

    if (!isLoggedIn()) {
        adminNotice.style.display = "block";
        bookingsMeta.textContent = "";
        return;
    }

    if (role !== "Admin") {
        adminNotice.style.display = "block";
        bookingsList.innerHTML = "";
        bookingsMeta.textContent = "";
        return;
    }

    adminNotice.style.display = "none";
    loadAllBookings();
})();
