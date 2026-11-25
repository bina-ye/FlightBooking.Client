// דף פרטי הזמנה בודדת
const detailsEl = document.getElementById("bookingDetails");
const detailsMessage = document.getElementById("detailsMessage");

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

function showDetailsMessage(text, type = "error") {
    detailsMessage.textContent = text;
    detailsMessage.classList.remove("message-error", "message-info", "message-success");
    if (text) detailsMessage.classList.add(`message-${type}`);
    detailsMessage.style.display = text ? "block" : "none";
}

// הגנה מפני הזרקת HTML — הערכים מוצגים ב-innerHTML
function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function renderBooking(booking) {
    // השדות עשויים לחזור ב-PascalCase או ב-camelCase
    const pick = (obj, ...keys) => {
        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null) return obj[key];
        }
        return null;
    };

    const id = pick(booking, "id", "Id");
    const reference = pick(booking, "bookingReference", "BookingReference");
    const status = pick(booking, "status", "Status");
    const createdAt = pick(booking, "createdAt", "CreatedAt");
    const totalAmount = pick(booking, "totalAmount", "TotalAmount");
    const seats = pick(booking, "seats", "Seats") || [];
    const flights = pick(booking, "flights", "Flights") || [];

    detailsEl.innerHTML = `
        <section class="flight-card">
            <div class="flight-main">
                <div class="flight-number">קוד הזמנה: ${escapeHtml(reference ?? "-")}</div>
                <div class="flight-route"><span class="badge">${escapeHtml(status ?? "-")}</span></div>
                <div class="flight-time">
                    <span>נוצרה: ${formatDateTime(createdAt)}</span>
                    <span>מזהה: ${id}</span>
                </div>
            </div>
            <div class="flight-side">
                <div class="flight-price">${formatPrice(totalAmount ?? 0)}</div>
            </div>
        </section>
    `;

    if (flights.length > 0) {
        const list = document.createElement("section");
        list.innerHTML = "<h2>טיסות</h2>";
        flights.forEach(f => {
            const row = document.createElement("div");
            row.className = "flight-card";
            row.innerHTML = `
                <div class="flight-main">
                    <div class="flight-number">${escapeHtml(pick(f, "flightNumber", "FlightNumber") ?? "")}</div>
                    <div class="flight-route">
                        <span class="airport">${escapeHtml(pick(f, "originCode", "OriginCode") ?? "")}</span>
                        <span class="arrow">←</span>
                        <span class="airport">${escapeHtml(pick(f, "destinationCode", "DestinationCode") ?? "")}</span>
                    </div>
                    <div class="flight-time">
                        <span>יציאה: ${formatDateTime(pick(f, "departureTime", "DepartureTime"))}</span>
                        <span>נחיתה: ${formatDateTime(pick(f, "arrivalTime", "ArrivalTime"))}</span>
                    </div>
                </div>
            `;
            list.appendChild(row);
        });
        detailsEl.appendChild(list);
    }

    if (seats.length > 0) {
        const seatSection = document.createElement("section");
        seatSection.innerHTML = "<h2>מושבים</h2>";
        const names = seats.map(s => pick(s, "seatNumber", "SeatNumber")).filter(Boolean);
        const p = document.createElement("p");
        p.textContent = names.join(", ");
        seatSection.appendChild(p);
        detailsEl.appendChild(seatSection);
    }

    detailsEl.hidden = false;
}

(async function init() {
    if (!isLoggedIn()) {
        showDetailsMessage("יש להתחבר כדי לצפות בפרטי ההזמנה.", "info");
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        showDetailsMessage("לא צוין מזהה הזמנה.");
        return;
    }

    try {
        const booking = await apiFetch(`/bookings/${id}`);

        if (!booking) {
            showDetailsMessage("לא נמצאו פרטי הזמנה.", "info");
            return;
        }

        renderBooking(booking);
    } catch (error) {
        if (error.status === 404) {
            showDetailsMessage("ההזמנה לא נמצאה.", "info");
        } else if (error.status === 403) {
            showDetailsMessage("אין לך הרשאה לצפות בהזמנה זו.");
        } else {
            showDetailsMessage("אירעה שגיאה בטעינת ההזמנה.");
            console.error(error);
        }
    }
})();