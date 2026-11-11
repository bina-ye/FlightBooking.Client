// כתובת ה-API
const API_BASE = "http://localhost:5069/api";

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
