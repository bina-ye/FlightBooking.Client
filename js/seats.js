// מושבים
const params = new URLSearchParams(window.location.search);
const flightId = params.get("flightId");

const seatsGrid = document.getElementById("seatsGrid");
const continueBtn = document.getElementById("continueBtn");
const seatsMessage = "seatsMessage";

let flight = null;
let selectedSeatIds = [];

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

// טעינת פרטי הטיסה והמושבים
async function loadSeats() {
    if (!flightId) {
        showMessage(seatsMessage, "לא נבחרה טיסה. חזרו לחיפוש.");
        return;
    }

    try {
        // פרטי הטיסה
        flight = await apiFetch(`/flights/${flightId}`);
        document.getElementById("flightNumber").textContent = flight.flightNumber;
        document.getElementById("flightRoute").textContent =
            `${flight.originCode} ← ${flight.destinationCode}`;
        document.getElementById("flightDeparture").textContent =
            formatDateTime(flight.departureTime);
        document.getElementById("flightPrice").textContent = formatPrice(flight.price);

        // מושבים
        const seats = await apiFetch(`/flights/${flightId}/seats`);
        renderSeats(seats);

    } catch (error) {
        showMessage(seatsMessage, error.message);
    }
}

function renderSeats(seats) {
    seatsGrid.innerHTML = "";

    if (!seats || seats.length === 0) {
        showMessage(seatsMessage, "לא נמצאו מושבים לטיסה זו.", "info");
        return;
    }

    // תצוגה בשורות ועמודות: כל שורת מושבים בשורה נפרדת
    const parsed = seats.map(seat => ({ seat, p: parseSeatNumber(seat.seatNumber) }));

    if (parsed.some(item => !item.p)) {
        // מספרי מושב לא תקניים — מציגים ברשת רגילה כדי לא לשבור את המסך
        seats.forEach(seat => seatsGrid.appendChild(seatButtonEl(seat)));
        return;
    }

    const rows = [...new Set(parsed.map(i => i.p.row))].sort((a, b) => a - b);
    const cols = [...new Set(parsed.map(i => i.p.col))].filter(Boolean).sort();
    const byKey = new Map(parsed.map(i => [`${i.p.row}${i.p.col}`, i.seat]));

    seatsGrid.classList.add("seat-map");
    seatsGrid.style.setProperty("--seat-cols", String(Math.max(cols.length, 1)));

    // שורת כותרות עמודות
    const head = document.createElement("div");
    head.className = "seat-map-row seat-map-head";
    head.setAttribute("aria-hidden", "true");
    cols.forEach(c => {
        const label = document.createElement("span");
        label.className = "seat-col-label";
        label.textContent = c;
        head.appendChild(label);
    });
    head.appendChild(document.createElement("span")).className = "seat-row-label";
    seatsGrid.appendChild(head);

    rows.forEach(row => {
        const rowEl = document.createElement("div");
        rowEl.className = "seat-map-row";

        cols.forEach((c, idx) => {
            const cell = document.createElement("span");
            cell.className = "seat-map-cell" + (idx === Math.floor(cols.length / 2) ? " seat-map-aisle" : "");

            const seat = byKey.get(`${row}${c}`);
            if (seat) {
                cell.appendChild(seatButtonEl(seat));
            } else {
                const empty = document.createElement("span");
                empty.className = "seat-map-empty";
                empty.setAttribute("aria-hidden", "true");
                cell.appendChild(empty);
            }
            rowEl.appendChild(cell);
        });

        const label = document.createElement("span");
        label.className = "seat-row-label";
        label.textContent = String(row);
        rowEl.appendChild(label);

        seatsGrid.appendChild(rowEl);
    });
}

function parseSeatNumber(seatNumber) {
    const m = String(seatNumber ?? "").trim().match(/^(\d+)\s*([A-Za-zא-ת]?)$/);
    return m ? { row: Number(m[1]), col: m[2].toUpperCase() } : null;
}

function seatButtonEl(seat) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seat";
    btn.textContent = seat.seatNumber;
    btn.dataset.seatId = seat.id;

    if (!seat.isAvailable) {
        btn.classList.add("booked");
        btn.disabled = true;
    } else {
        btn.addEventListener("click", () => toggleSeat(seat.id, btn));
    }
    return btn;
}

// בחירה וביטול בחירה
function toggleSeat(seatId, button) {
    if (selectedSeatIds.includes(seatId)) {
        selectedSeatIds = selectedSeatIds.filter(id => id !== seatId);
        button.classList.remove("selected");
    } else {
        selectedSeatIds.push(seatId);
        button.classList.add("selected");
    }

    updateSummary();
}

function updateSummary() {
    const numbers = Array.from(document.querySelectorAll(".seat.selected"))
        .map(el => el.textContent);

    document.getElementById("selectedSeats").textContent =
        numbers.length ? numbers.join(", ") : "לא נבחרו";

    const total = (flight?.price || 0) * numbers.length;
    document.getElementById("totalPrice").textContent = formatPrice(total);

    continueBtn.disabled = numbers.length === 0;
}

// המשך להזמנה
continueBtn.addEventListener("click", () => {
    if (selectedSeatIds.length === 0) return;

    const bookingParams = new URLSearchParams({
        flightId,
        seatIds: selectedSeatIds.join(",")
    });

    window.location.href = `booking.html?${bookingParams.toString()}`;
});

loadSeats();