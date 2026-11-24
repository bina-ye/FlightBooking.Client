/* ============================================================
   ההזמנות שלי — תצוגה, עריכה (כולל החלפת מושבים) וביטול
   ============================================================ */

const bookingsList = document.getElementById("bookingsList");
const paginationEl = document.getElementById("pagination");
const loginNotice = document.getElementById("loginNotice");
const bookingsMessage = document.getElementById("bookingsMessage");

let currentPage = 1;
const pageSize = 10;

/* מצב העריכה הנוכחית */
let currentBooking = null;        // BookingResponse מהשרת
let mySeatIds = new Set();        // מושבים שכבר שייכים להזמנה
let selectedSeatIds = new Set();  // הבחירה הנוכחית (כולל שלי)
let seatsByFlight = [];           // [{ flightId, title, seats: [...] }]

/* ---------- פורמט ---------- */

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

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
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
                <span class="badge">${escapeHtml(item.status)}</span>
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
            <div class="booking-actions">
                <button type="button" class="btn btn-secondary"
                        onclick="openEditBooking(${item.id})"
                        ${isCancelled ? "disabled" : ""}>עריכה</button>
                <button type="button" class="btn btn-danger"
                        onclick="cancelBookingRow(${item.id})"
                        ${isCancelled ? "disabled" : ""}>ביטול</button>
            </div>
        </div>
    `;

    return card;
}

/* ---------- pagination ---------- */

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

/* ---------- טעינה ---------- */

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

/* ============================================================
   עריכה
   ============================================================ */

async function openEditBooking(id) {
    const msgEl = document.getElementById("editBookingMessage");
    showMessage(msgEl, "");

    const modal = document.getElementById("editBookingModal");
    const summary = document.getElementById("editSeatsSummary");
    const grid = document.getElementById("editSeatsGrid");

    summary.textContent = "טוען מושבים...";
    grid.innerHTML = "";
    modal.classList.add("open");

    try {
        const booking = await apiFetch(`/bookings/${id}`);
        currentBooking = booking;

        /* מילוי שדות */
        document.getElementById("editPassengerFullName").value =
            booking.passengerFullName || "";
        document.getElementById("editPassportNumber").value = "";
        document.getElementById("editMealType").value =
            mealToValue(booking.mealType);
        document.getElementById("editKashrutLevel").value =
            kashrutToValue(booking.kashrutLevel);
        document.getElementById("editSpecialRequests").value =
            booking.specialRequests || "";

        /* מושבי ההזמנה — נקודת המוצא של הבחירה */
        mySeatIds = new Set((booking.seats || []).map(s => s.id));
        selectedSeatIds = new Set(mySeatIds);

        /* טעינת מושבים לכל טיסה בהזמנה */
        await loadSeatsForBooking(booking);

        renderSeatsGrid();
        updateSeatsSummary();

        /* איפוס סימון שגיאה */
        clearPassportHint();

    } catch (error) {
        summary.textContent = "";
        showMessage(msgEl, error.message);
    }
}

async function loadSeatsForBooking(booking) {
    const flights = booking.flights || [];
    seatsByFlight = [];

    for (let i = 0; i < flights.length; i++) {
        const flight = flights[i];
        const flightId = flight.id ?? flight.flightId;
        if (!flightId) continue;

        try {
            const seats = await apiFetch(`/flights/${flightId}/seats`);
            seatsByFlight.push({
                flightId,
                title: buildFlightTitle(flight, i),
                seats: Array.isArray(seats) ? seats : []
            });
        } catch {
            seatsByFlight.push({
                flightId,
                title: buildFlightTitle(flight, i),
                seats: [],
                error: true
            });
        }
    }
}

function buildFlightTitle(flight, index) {
    const from = flight.departureAirport || flight.origin || flight.from || "";
    const to = flight.arrivalAirport || flight.destination || flight.to || "";
    const number = flight.flightNumber || flight.number || "";
    const route = from && to ? `${from} → ${to}` : "";
    const parts = [`טיסה ${index + 1}`];
    if (number) parts.push(number);
    if (route) parts.push(route);
    return parts.join(" · ");
}

function renderSeatsGrid() {
    const grid = document.getElementById("editSeatsGrid");

    if (seatsByFlight.length === 0) {
        grid.innerHTML =
            '<div class="hint">לא נמצאו מושבים להצגה עבור הזמנה זו.</div>';
        return;
    }

    grid.innerHTML = seatsByFlight.map(group => {
        const buttons = group.seats.length === 0
            ? '<div class="hint">לא ניתן לטעון את מושבי הטיסה.</div>'
            : `<div class="seat-row-buttons">${
                group.seats.map(seat => seatButtonHtml(seat)).join("")
            }</div>`;

        return `
            <div class="seat-flight-group">
                <div class="seat-flight-title">${escapeHtml(group.title)}</div>
                ${buttons}
            </div>
        `;
    }).join("");
}

function seatButtonHtml(seat) {
    const isMine = mySeatIds.has(seat.id);
    const isSelected = selectedSeatIds.has(seat.id);
    const isTaken = !seat.isAvailable && !isMine;

    let cls = "seat-btn";
    if (isTaken) {
        cls += " seat-taken";
    } else if (isMine && isSelected) {
        cls += " seat-mine";           // שלי, נשאר
    } else if (isMine && !isSelected) {
        cls += " seat-releasing";      // שלי, מיועד להחלפה
    } else if (isSelected) {
        cls += " seat-selected";       // מושב חדש שנבחר
    }

    const disabled = isTaken ? "disabled" : "";
    const label = escapeHtml(seat.seatNumber || String(seat.id));
    return `<button type="button" class="${cls}" ${disabled}
                    onclick="toggleSeat(${seat.id})">${label}</button>`;
}

/* ============================================================
   בחירת מושבים — מנגנון החלפה בלבד, ללא הוספה
   ============================================================ */

function toggleSeat(seatId) {
    const isMine = mySeatIds.has(seatId);

    /* --- לחיצה על מושב שלי: מסומן / מבוטל כמועמד להחלפה --- */
    if (isMine) {
        if (selectedSeatIds.has(seatId)) {
            selectedSeatIds.delete(seatId);   // יסומן "ישוחרר"
        } else {
            selectedSeatIds.add(seatId);      // חוזר להזמנה
        }
        renderSeatsGrid();
        updateSeatsSummary();
        return;
    }

    /* --- לחיצה על מושב פנוי --- */
    const mineForReplacement =
        [...mySeatIds].filter(id => !selectedSeatIds.has(id));
    const newSelectedCount =
        [...selectedSeatIds].filter(id => !mySeatIds.has(id)).length;

    // יש מושב שלי שממתין להחלפה — מחליפים
    if (mineForReplacement.length > 0) {
        if (selectedSeatIds.has(seatId)) {
            selectedSeatIds.delete(seatId);
        } else {
            selectedSeatIds.add(seatId);
        }
        renderSeatsGrid();
        updateSeatsSummary();
        return;
    }

    // אין מועמד להחלפה — אסור להוסיף מושבים
    if (newSelectedCount >= mySeatIds.size) {
        showMessage(
            document.getElementById("editBookingMessage"),
            "לא ניתן להוסיף מושבים בהזמנה זו. כדי להחליף — לחצו תחילה על המושב הקיים שלכם (יסומן בכתום), ואחר כך על המושב החדש.",
            "info");
        return;
    }

    // מושב פנוי רגיל, כשעדיין יש "מקום" בהזמנה
    if (selectedSeatIds.has(seatId)) {
        selectedSeatIds.delete(seatId);
    } else {
        selectedSeatIds.add(seatId);
    }
    renderSeatsGrid();
    updateSeatsSummary();
}

function updateSeatsSummary() {
    const summary = document.getElementById("editSeatsSummary");
    const kept = [];
    const added = [];
    const releasing = [];

    seatsByFlight.forEach(group => {
        group.seats.forEach(seat => {
            const label = seat.seatNumber || String(seat.id);
            const isMine = mySeatIds.has(seat.id);
            const isSelected = selectedSeatIds.has(seat.id);

            if (isMine && isSelected) kept.push(label);
            else if (isMine && !isSelected) releasing.push(label);
            else if (!isMine && isSelected) added.push(label);
        });
    });

    const total = kept.length + added.length;
    const required = mySeatIds.size;

    let text = `מושבים בהזמנה: ${total} מתוך ${required}`;

    if (kept.length > 0) text += ` · נשארים: ${kept.join(", ")}`;
    if (added.length > 0) text += ` · חדשים: ${added.join(", ")}`;
    if (releasing.length > 0) text += ` · משוחררים: ${releasing.join(", ")}`;

    if (total < required) {
        text += ` · חסרים ${required - total} מושבים — יש לבחור מושב חלופי.`;
    } else if (total === required && releasing.length > 0) {
        text += " · מוכן לשמירה.";
    } else if (total === required && added.length === 0) {
        text += " · להחלפה: לחצו קודם על מושב קיים, ואחר כך על מושב פנוי.";
    }

    summary.textContent = text;
}

function closeEditBooking() {
    currentBooking = null;
    mySeatIds = new Set();
    selectedSeatIds = new Set();
    seatsByFlight = [];
    document.getElementById("editBookingModal").classList.remove("open");
}

/* ============================================================
   שמירה
   ============================================================ */

async function saveBookingEdit() {
    if (!currentBooking) return;

    const msgEl = document.getElementById("editBookingMessage");
    showMessage(msgEl, "");

    const passengerFullName =
        document.getElementById("editPassengerFullName").value.trim();
    const passportNumber =
        document.getElementById("editPassportNumber").value.trim();
    const specialRequests =
        document.getElementById("editSpecialRequests").value.trim();

    /* --- ולידציה: שדות חובה --- */
    const missing = [];
    let passportMissing = false;

    if (!passengerFullName) {
        missing.push("שם נוסע");
    } else if (passengerFullName.length > 200) {
        showMessage(msgEl, "שם הנוסע ארוך מ-200 תווים.");
        return;
    }

    if (!passportNumber) {
        missing.push("מספר דרכון");
        passportMissing = true;
    } else if (passportNumber.length > 30) {
        showMessage(msgEl, "מספר הדרכון ארוך מ-30 תווים.");
        return;
    }

    if (specialRequests.length > 500) {
        showMessage(msgEl, "הבקשות המיוחדות ארוכות מ-500 תווים.");
        return;
    }

    /* --- הדגשת שדה דרכון חסר --- */
    const passportEl = document.getElementById("editPassportNumber");
    const passportHint = document.getElementById("editPassportHint");

    passportEl.classList.toggle("input-error", passportMissing);

    if (passportHint) {
        passportHint.textContent = passportMissing
            ? "יש למלא מספר דרכון"
            : "מטעמי אבטחה אין השרת מחזיר את מספר הדרכון — יש להזינו מחדש.";
        passportHint.classList.toggle("hint-error", passportMissing);
    }

    if (missing.length > 0) {
        showMessage(msgEl,
            `חסרים פרטים: ${missing.join(", ")}. יש למלא לפני השמירה.`);
        return;
    }

    /* --- ולידציה: מספר מושבים סופי חייב להיות זהה למקורי --- */
    if (selectedSeatIds.size > mySeatIds.size) {
        showMessage(msgEl,
            `לא ניתן לאשר: נבחרו ${selectedSeatIds.size} מושבים, ` +
            `אך בהזמנה יש ${mySeatIds.size}. ` +
            `כדי להחליף — לחצו תחילה על המושב הקיים, ואחר כך על המושב החדש.`);
        return;
    }

    if (selectedSeatIds.size < mySeatIds.size) {
        showMessage(msgEl,
            `לא ניתן לאשר: נבחרו ${selectedSeatIds.size} מושבים בלבד, ` +
            `אך בהזמנה יש ${mySeatIds.size}. ` +
            `יש לבחור מושב חלופי לכל מושב שמשוחרר.`);
        return;
    }

    const payload = {
        passengerFullName,
        passportNumber,
        mealType: Number(document.getElementById("editMealType").value) || 0,
        kashrutLevel: Number(document.getElementById("editKashrutLevel").value) || 0,
        specialRequests: specialRequests || null,
        seatIds: Array.from(selectedSeatIds)
    };

    const saveBtn = document.getElementById("editBookingSaveBtn");
    saveBtn.disabled = true;
    try {
        const updated = await apiFetch(`/bookings/${currentBooking.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        closeEditBooking();
        showMessage(bookingsMessage,
            `ההזמנה ${updated.bookingReference} עודכנה בהצלחה`, "success");
        await loadBookings();
    } catch (error) {
        if (error.status === 409) {
            showMessage(msgEl,
                "אחד המושבים שנבחרו נתפס על ידי משתמש אחר בינתיים. ההזמנה לא עודכנה — אנא בחרו מושב פנוי אחר ונסו שוב.",
                "error");
        } else {
            showMessage(msgEl, error.message);
        }
        if (error.status === 401) {
            clearToken();
            window.location.href = "login.html";
        }
    } finally {
        saveBtn.disabled = false;
    }
}

/* ---------- ביטול ---------- */

async function cancelBookingRow(id) {
    const ok = confirm(
        "לבטל את ההזמנה? הפעולה אינה ניתנת לשחזור והמושבים ישוחררו.");
    if (!ok) return;

    try {
        await apiFetch(`/bookings/${id}`, { method: "DELETE" });
        showMessage(bookingsMessage, "ההזמנה בוטלה בהצלחה", "success");
        await loadBookings();
    } catch (error) {
        showMessage(bookingsMessage, error.message);
        if (error.status === 401) {
            clearToken();
            window.location.href = "login.html";
        }
    }
}

/* ---------- המרות enum ---------- */

const MEAL_LABELS = {
    0: "None", 1: "Regular", 2: "Vegetarian", 3: "Vegan", 4: "GlutenFree"
};
const KASHRUT_LABELS = {
    0: "None", 1: "Kosher", 2: "Glatt", 3: "Mehadrin"
};

function mealToValue(meal) {
    if (typeof meal === "number") return meal;
    const key = String(meal || "").trim();
    const found = Object.entries(MEAL_LABELS).find(
        ([, label]) => label.toLowerCase() === key.toLowerCase());
    return found ? Number(found[0]) : 0;
}

function kashrutToValue(kashrut) {
    if (typeof kashrut === "number") return kashrut;
    const key = String(kashrut || "").trim();
    const found = Object.entries(KASHRUT_LABELS).find(
        ([, label]) => label.toLowerCase() === key.toLowerCase());
    return found ? Number(found[0]) : 0;
}

/* ---------- איפוס הודעת דרכון ---------- */

function clearPassportHint() {
    const el = document.getElementById("editPassportNumber");
    const hint = document.getElementById("editPassportHint");
    if (el) el.classList.remove("input-error");
    if (hint) {
        hint.textContent =
            "מטעמי אבטחה אין השרת מחזיר את מספר הדרכון — יש להזינו מחדש.";
        hint.classList.remove("hint-error");
    }
}

document.getElementById("editPassportNumber")
    ?.addEventListener("input", clearPassportHint);

/* ---------- ניווט ---------- */

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

if (!isLoggedIn()) {
    loginNotice.style.display = "block";
} else {
    loadBookings();
}