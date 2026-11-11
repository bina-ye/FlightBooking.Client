const bookingsList = document.getElementById("bookingsList");
const paginationEl = document.getElementById("pagination");
const loginNotice = document.getElementById("loginNotice");

const bookingsMessage = document.getElementById("bookingsMessage");
let currentPage = 1;
const pageSize = 10;

function formatDateTime(isoString) {
    if (!isoString) return "";
    return new Date(isoString).toLocaleString("he-IL", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

function formatPrice(amount) {
    return new Intl.NumberFormat("he-IL", {
        style: "currency", currency: "ILS", maximumFractionDigits: 0
    }).format(amount);
}

function renderBooking(item) {
    const card = document.createElement("article");
    card.className = "flight-card";

    card.innerHTML = `
        <div class="flight-main">
            <div class="flight-number">קוד הזמנה: ${item.bookingReference}</div>
            <div class="flight-route">
                <span class="badge">${item.status}</span>
            </div>
            <div class="flight-time">
                <span>נוצרה: ${formatDateTime(item.createdAt)}</span>
                <span>המראה: ${formatDateTime(item.firstDepartureTime)}</span>
                <span>${item.seatsCount} מושבים · ${item.flightsCount} טיסות</span>
            </div>
        </div>
        <div class="flight-side">
            <div class="flight-price">${formatPrice(item.totalAmount)}</div>
            <a class="btn btn-secondary" href="booking-details.html?id=${item.id}">פרטים</a>
        </div>
    `;

    return card;
}

function renderPagination(pageNumber, totalPages) {
    paginationEl.innerHTML = "";
    if (totalPages <= 1) return;

    const add = (label, page, disabled = false) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-page" + (page === pageNumber ? " active" : "");
        btn.textContent = label;
        btn.disabled = disabled;
        btn.addEventListener("click", () => { currentPage = page; loadBookings(); });
        paginationEl.appendChild(btn);
    };

    add("הקודם", pageNumber - 1, pageNumber <= 1);
    for (let p = 1; p <= totalPages; p++) add(String(p), p, p === pageNumber);
    add("הבא", pageNumber + 1, pageNumber >= totalPages);
}

async function loadBookings() {
    if (!isLoggedIn()) {
        loginNotice.style.display = "block";
        return;
    }

    loginNotice.style.display = "none";
    showMessage(bookingsMessage, "");

    try {
        const data = await apiFetch(
            `/bookings/my?pageNumber=${currentPage}&pageSize=${pageSize}`);

//         const items = data.items || [];
//         bookingsList.innerHTML = "";

//         if (items.length === 0) {
//     showMessage(bookingsMessage, "עדיין לא בוצעו הזמנות.", "info");
//     bookingsMessage.style.display = "block";
//     paginationEl.innerHTML = "";
//     return;
// }

//         items.forEach(item => bookingsList.appendChild(renderBooking(item)));
const items = data.items || [];
bookingsList.innerHTML = "";

if (items.length === 0) {
    bookingsList.innerHTML =
        '<div class="message message-info" style="display:block">עדיין לא בוצעו הזמנות.</div>';
    paginationEl.innerHTML = "";
    return;
}

items.forEach(item => bookingsList.appendChild(renderBooking(item)));
        const totalPages = data.totalPages
            || Math.ceil((data.totalCount || items.length) / pageSize);
        renderPagination(currentPage, totalPages);

    } catch (error) {
        showMessage(bookingsMessage, error.message);
    }
}

// עדכון ניווט
(function updateNav() {
    const navLogin = document.getElementById("navLogin");
    const navLogout = document.getElementById("navLogout");
    const navMyBookings = document.getElementById("navMyBookings");

    if (isLoggedIn()) {
        if (navLogin) navLogin.hidden = true;
        if (navLogout) navLogout.hidden = false;
        if (navMyBookings) navMyBookings.hidden = false;
    }
    if (navLogout) {
        navLogout.addEventListener("click", e => {
            e.preventDefault();
            clearToken();
            window.location.href = "index.html";
        });
    }
})();

loadBookings();