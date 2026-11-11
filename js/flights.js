// טופס חיפוש הטיסות
const searchForm = document.getElementById("searchForm");
const resultsSection = document.getElementById("resultsSection");
const resultsEl = document.getElementById("results");
const paginationEl = document.getElementById("pagination");
const searchMessage = "searchMessage";

let currentPage = 1;
const pageSize = 10;

// תאריך ברירת מחדל — מחר
function setDefaultDate() {
    const input = document.getElementById("departureDate");
    if (!input.value) {
        const future = new Date();
        future.setDate(future.getDate() + 30);
        input.value = future.toISOString().split("T")[0];
    }
}
// תצוגת שעה
function formatDateTime(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatPrice(amount) {
    return new Intl.NumberFormat("he-IL", {
        style: "currency",
        currency: "ILS",
        maximumFractionDigits: 0
    }).format(amount);
}

// הצגת כרטיס טיסה
function renderFlight(flight) {
    const card = document.createElement("article");
    card.className = "flight-card";

    const isClosed = flight.departureTime && new Date(flight.departureTime) <= new Date();

    card.innerHTML = `
        <div class="flight-main">
            <div class="flight-number">${flight.flightNumber}</div>
            <div class="flight-route">
                <span class="airport">${flight.originCode}</span>
                <span class="arrow">←</span>
                <span class="airport">${flight.destinationCode}</span>
            </div>
            <div class="flight-time">
                <span>יציאה: ${formatDateTime(flight.departureTime)}</span>
                <span>נחיתה: ${formatDateTime(flight.arrivalTime)}</span>
            </div>
        </div>
        <div class="flight-side">
            <div class="flight-price">${formatPrice(flight.price)}</div>
            <a class="btn btn-primary ${isClosed ? "disabled" : ""}"
               href="${isClosed ? "#" : `seats.html?flightId=${flight.id}`}">
                ${isClosed ? "הטיסה המריאה" : "בחירת מושב"}
            </a>
        </div>
    `;

    return card;
}

// עימוד
function renderPagination(pageNumber, totalPages) {
    paginationEl.innerHTML = "";
    if (totalPages <= 1) return;

    const createButton = (label, page, disabled = false) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-page" + (page === pageNumber ? " active" : "");
        btn.textContent = label;
        btn.disabled = disabled;
        btn.addEventListener("click", () => {
            currentPage = page;
            runSearch();
        });
        return btn;
    };

    paginationEl.appendChild(createButton("הקודם", pageNumber - 1, pageNumber <= 1));

    for (let p = 1; p <= totalPages; p++) {
        paginationEl.appendChild(createButton(String(p), p, p === pageNumber));
    }

    paginationEl.appendChild(createButton("הבא", pageNumber + 1, pageNumber >= totalPages));
}

// ביצוע החיפוש
async function runSearch() {
    const origin = document.getElementById("origin").value;
    const destination = document.getElementById("destination").value;
    const departureDate = document.getElementById("departureDate").value;

    showMessage(searchMessage, "");

    if (origin === destination) {
        showMessage(searchMessage, "המוצא והיעד חייבים להיות שונים.");
        return;
    }

   const params = new URLSearchParams({
        originCode: origin,
        destinationCode: destination,
        departureDate,
        pageNumber: currentPage,
        pageSize
    });
    try {
        const data = await apiFetch(`/flights?${params.toString()}`);

        const items = data.items || [];
        resultsEl.innerHTML = "";

        if (items.length === 0) {
            showMessage(searchMessage, "לא נמצאו טיסות. נסו תאריך אחר.", "info");
            resultsSection.hidden = true;
            return;
        }

        items.forEach(flight => resultsEl.appendChild(renderFlight(flight)));
        resultsSection.hidden = false;

        const totalPages = data.totalPages
            || Math.ceil((data.totalCount || items.length) / pageSize);
        renderPagination(currentPage, totalPages);

    } catch (error) {
        resultsSection.hidden = true;
        showMessage(searchMessage, error.message);
    }
}

// אירועים
searchForm.addEventListener("submit", event => {
    event.preventDefault();
    currentPage = 1;
    runSearch();
});

// אתחול
setDefaultDate();