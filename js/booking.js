// פרמטרים מהכתובת
const params = new URLSearchParams(window.location.search);
const flightId = params.get("flightId");
const seatIdsParam = params.get("seatIds") || "";

const seatIds = seatIdsParam
    ? seatIdsParam.split(",").map(Number).filter(n => !Number.isNaN(n))
    : [];

const bookingContent = document.getElementById("bookingContent");
const loginNotice = document.getElementById("loginNotice");
const bookingForm = document.getElementById("bookingForm");
const bookingMessage = "bookingMessage";

let flight = null;

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

// טעינת סיכום ההזמנה
async function loadSummary() {
    // בדיקת התחברות
    if (!isLoggedIn()) {
        loginNotice.style.display = "block";
        bookingContent.hidden = true;
        return;
    }

    loginNotice.style.display = "none";
    bookingContent.hidden = false;

    if (!flightId || seatIds.length === 0) {
        showMessage(bookingMessage, "פרטי ההזמנה חסרים. חזרו לבחירת מושב.");
        return;
    }

    try {
        flight = await apiFetch(`/flights/${flightId}`);

        document.getElementById("summaryFlight").textContent =
            `${flight.flightNumber} · ${flight.originCode} ← ${flight.destinationCode} · ${formatDateTime(flight.departureTime)}`;

        // מספרי המושבים
        const seats = await apiFetch(`/flights/${flightId}/seats`);
        const chosenNumbers = seats
            .filter(s => seatIds.includes(s.id))
            .map(s => s.seatNumber);

        document.getElementById("summarySeats").textContent =
            chosenNumbers.length ? chosenNumbers.join(", ") : `${seatIds.length} מושבים`;

        const total = flight.price * seatIds.length;
        document.getElementById("summaryTotal").textContent = formatPrice(total);

    } catch (error) {
        showMessage(bookingMessage, error.message);
    }
}

// שליחת ההזמנה
bookingForm.addEventListener("submit", async event => {
    event.preventDefault();

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    showMessage(bookingMessage, "");

    const body = {
        seatIds,
        passengerFullName: document.getElementById("fullName").value.trim(),
        passportNumber: document.getElementById("passport").value.trim(),
        mealType: Number(document.getElementById("mealType").value),
        kashrutLevel: Number(document.getElementById("kashrutLevel").value),
        specialRequests: document.getElementById("specialRequests").value.trim() || null,
        payment: {
            cardNumber: document.getElementById("cardNumber").value.trim(),
            expiry: document.getElementById("expiry").value.trim(),
            cvv: document.getElementById("cvv").value.trim()
        }
    };

    try {
        const booking = await apiFetch("/bookings", {
            method: "POST",
            body: JSON.stringify(body)
        });

        // שמירת פרטי ההזמנה למעבר לדף האישור
        sessionStorage.setItem("lastBooking", JSON.stringify(booking));
        window.location.href = "confirmation.html";

    } catch (error) {
        // 409 — המושב נתפס בינתיים
        if (error.status === 409) {
            showMessage(bookingMessage,
                "המושב נתפס על ידי משתמש אחר. אנא בחרו מושב אחר.");
        } else if (error.status === 401) {
            showMessage(bookingMessage, "פג תוקף ההתחברות. יש להתחבר מחדש.");
            setTimeout(() => window.location.href = "login.html", 1500);
        } else {
            showMessage(bookingMessage, error.message);
        }
        submitBtn.disabled = false;
    }
});

loadSummary();