// כתובת ה-API — זיהוי אוטומטי לפי הסביבה
// פיתוח מקומי: השרת רץ על localhost:5069
// פרודקשן (Render): לקוח סטטי שנטען מדומיין ציבורי → API של Render
const API_BASE = (() => {
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    return isLocal
        ? "http://localhost:5069/api"
        : "https://flightbooking-api-we1l.onrender.com/api";
})();

// שמירת הטוקן
const TOKEN_KEY = "flightbooking_token";


function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}


function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}
function isLoggedIn() {
    return !!getToken();
}

// קריאה כללית ל-API
async function apiFetch(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = getToken();
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // 401 — הטוקן פג או לא תקין
    if (response.status === 401) {
        clearToken();
    }

    let body = null;
    const text = await response.text();
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }

    if (!response.ok) {
        const message = body?.message
            || body?.title
            || (body?.errors ? Object.values(body.errors).flat().join(" ") : null)
            || `שגיאה (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.body = body;
        throw error;
    }

    return body;
}

// הודעות למשתמש
function showMessage(elementId, text, type = "error") {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `message message-${type}`;
    el.style.display = text ? "block" : "none";
}
/* ============================================================
   הזמנות — עדכון ומחיקה
   ============================================================ */

// שליפת הזמנה בודדת (נדרש לטופס עריכה — ממלאים את השדות מהשרת)
async function getBooking(id) {
    if (!id) throw new Error("חסר מזהה הזמנה");
    return apiFetch(`/bookings/${id}`);
}

// עדכון הזמנה — PUT מלא. חייב לשלוח את כל השדות + SeatsIds
// מחזיר BookingResponse (200)
async function updateBooking(id, bookingUpdateRequest) {
    if (!id) throw new Error("חסר מזהה הזמנה");
    if (!bookingUpdateRequest) throw new Error("חסרים נתוני עדכון");

    const seatIds = Array.isArray(bookingUpdateRequest.seatIds)
        ? bookingUpdateRequest.seatIds
        : [];
    if (seatIds.length === 0) {
        throw new Error("חובה לבחור לפחות מושב אחד");
    }

    const payload = {
        passengerFullName: (bookingUpdateRequest.passengerFullName || "").trim(),
        passportNumber: (bookingUpdateRequest.passportNumber || "").trim(),
        mealType: Number(bookingUpdateRequest.mealType) || 0,
        kashrutLevel: Number(bookingUpdateRequest.kashrutLevel) || 0,
        specialRequests: bookingUpdateRequest.specialRequests
            ? bookingUpdateRequest.specialRequests.trim()
            : null,
        seatIds: seatIds.map(Number)
    };

    return apiFetch(`/bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
    });
}

// ביטול הזמנה (DELETE) — מחזיר 204 ללא גוף
async function cancelBooking(id) {
    if (!id) throw new Error("חסר מזהה הזמנה");

    await apiFetch(`/bookings/${id}`, { method: "DELETE" });
    return true;
}

// רשימת ההזמנות שלי (לתצוגה לפני בחירת הזמנה לעריכה/ביטול)
async function getMyBookings(pageNumber = 1, pageSize = 10) {
    const params = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize)
    });
    return apiFetch(`/bookings/my?${params.toString()}`);
}