const noBooking = document.getElementById("noBooking");
const confirmationContent = document.getElementById("confirmationContent");

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

// מפוי שמות enum לתצוגה
const MEAL_LABELS = {
    None: "ללא ארוחה",
    Regular: "רגילה",
    Vegetarian: "צמחונית",
    Vegan: "טבעונית",
    GlutenFree: "ללא גלוטן"
};

const KASHRUT_LABELS = {
    None: "לא נדרש",
    Kosher: "כשר",
    GlattKosher: "גלאט כשר",
    Mehadrin: "מהדרין"
};

function renderBooking(booking) {
    document.getElementById("bookingReference").textContent = booking.bookingReference || "—";
    document.getElementById("bookingStatus").textContent = booking.status || "—";
    document.getElementById("passengerName").textContent = booking.passengerFullName || "—";
    document.getElementById("bookingTotal").textContent = formatPrice(booking.totalAmount || 0);
    document.getElementById("mealType").textContent =
        MEAL_LABELS[booking.mealType] || booking.mealType || "—";
    document.getElementById("kashrutLevel").textContent =
        KASHRUT_LABELS[booking.kashrutLevel] || booking.kashrutLevel || "—";

    // פרטי הטיסה — כולל שער ועלייה למטוס
    const flightsEl = document.getElementById("flightsDetails");
    flightsEl.innerHTML = "";

    (booking.flights || []).forEach(segment => {
        const box = document.createElement("div");
        box.className = "summary-box";
        box.innerHTML = `
            <div class="summary-row">
                <span class="label">מספר טיסה</span>
                <span>${segment.flightNumber || "—"}</span>
            </div>
            <div class="summary-row">
                <span class="label">מסלול</span>
                <span>${segment.originCode} ← ${segment.destinationCode}</span>
            </div>
            <div class="summary-row">
                <span class="label">המראה</span>
                <span>${formatDateTime(segment.departureTime)}</span>
            </div>
            <div class="summary-row">
                <span class="label">נחיתה</span>
                <span>${formatDateTime(segment.arrivalTime)}</span>
            </div>
            <div class="summary-row">
                <span class="label">שער</span>
                <span>${segment.gate || "—"}</span>
            </div>
            <div class="summary-row">
                <span class="label">עלייה למטוס</span>
                <span>${formatDateTime(segment.boardingTime)}</span>
            </div>
            <div class="summary-row">
                <span class="label">פתיחת צ'ק-אין</span>
                <span>${formatDateTime(segment.checkInOpensAt)}</span>
            </div>
        `;
        flightsEl.appendChild(box);
    });

    // מושבים
    const seatsEl = document.getElementById("seatsDetails");
    const seats = (booking.seats || []).map(s => s.seatNumber).join(", ");
    seatsEl.innerHTML = `
        <div class="summary-row">
            <span class="label">מושבים</span>
            <span>${seats || "—"}</span>
        </div>
    `;

    confirmationContent.hidden = false;
}

// טעינה
(function init() {
    const raw = sessionStorage.getItem("lastBooking");

    if (raw) {
        try {
            renderBooking(JSON.parse(raw));
            return;
        } catch {
            sessionStorage.removeItem("lastBooking");
        }
    }

    noBooking.style.display = "block";
})();