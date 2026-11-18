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

/* ---------- ולידציה ---------- */

function markField(id, hasError) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("input-error", hasError);
}

function clearErrors() {
    ["fullName", "passport", "cardNumber", "expiry", "cvv"]
        .forEach(id => markField(id, false));
}

function validateForm() {
    const fullName = document.getElementById("fullName").value.trim();
    const passport = document.getElementById("passport").value.trim();
    const cardNumber = document.getElementById("cardNumber").value.trim();
    const expiry = document.getElementById("expiry").value.trim();
    const cvv = document.getElementById("cvv").value.trim();

    const missing = [];
    const invalid = [];

    if (!fullName) missing.push("שם מלא");
    if (!passport) missing.push("מספר דרכון");

    if (!cardNumber) {
        missing.push("מספר כרטיס");
    } else if (!/^\d{16}$/.test(cardNumber)) {
        invalid.push("מספר הכרטיס חייב להיות 16 ספרות");
    }

    if (!expiry) {
        missing.push("תוקף הכרטיס");
    } else if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        invalid.push("תוקף הכרטיס חייב להיות במבנה MM/YY");
    } else {
        const [mm, yy] = expiry.split("/").map(Number);
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;

        if (mm < 1 || mm > 12) {
            invalid.push("חודש התוקף אינו תקין");
        } else if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
            invalid.push("תוקף הכרטיס פג");
        }
    }

    if (!cvv) {
        missing.push("CVV");
    } else if (!/^\d{3}$/.test(cvv)) {
        invalid.push("CVV חייב להיות 3 ספרות");
    }

    // סימון שדות בעייתיים
    markField("fullName", !fullName);
    markField("passport", !passport);
    markField("cardNumber", !cardNumber || !/^\d{16}$/.test(cardNumber));
    markField("expiry", !expiry || !/^\d{2}\/\d{2}$/.test(expiry));
    markField("cvv", !cvv || !/^\d{3}$/.test(cvv));

    if (missing.length === 0 && invalid.length === 0) return true;

    const parts = [];
    if (missing.length > 0) {
        parts.push(`חסרים פרטים: ${missing.join(", ")}`);
    }
    if (invalid.length > 0) {
        parts.push(invalid.join(" · "));
    }

    showMessage(bookingMessage, parts.join(". ") + ".", "error");
    return false;
}

/* ---------- טעינת סיכום ההזמנה ---------- */

async function loadSummary() {
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

/* ---------- שליחת ההזמנה ---------- */

bookingForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearErrors();
    showMessage(bookingMessage, "");

    if (!validateForm()) return;

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;

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

        sessionStorage.setItem("lastBooking", JSON.stringify(booking));
        window.location.href = "confirmation.html";

    } catch (error) {
        if (error.status === 409) {
    showMessage(bookingMessage,
        "המושב נתפס על ידי משתמש אחר. לא בוצע חיוב — אנא בחרו מושב אחר ונסו שוב.", "error");
    // אפשר גם להחזיר אוטומטית למסך בחירת מושב אחרי 3 שניות
    // setTimeout(() => window.location.href = `seats.html?flightId=${flightId}`, 3000);
}
        // if (error.status === 409) {
        //     showMessage(bookingMessage,
        //         "המושב נתפס על ידי משתמש אחר. אנא בחרו מושב אחר.");
        // }
         else if (error.status === 401) {

            showMessage(bookingMessage, "פג תוקף ההתחברות. יש להתחבר מחדש.");
            setTimeout(() => window.location.href = "login.html", 1500);
        } else {
            showMessage(bookingMessage, error.message);
        }
        submitBtn.disabled = false;
    }
});

/* ---------- הסרת סימון שגיאה בהקלדה ---------- */

["fullName", "passport", "cardNumber", "expiry", "cvv"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => markField(id, false));
});

loadSummary();