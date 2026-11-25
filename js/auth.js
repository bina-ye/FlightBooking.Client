// ===== התחברות =====
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        showMessage("loginMessage", "");

        try {
            const data = await apiFetch("/auth/tokens", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            // תמיכה בשמות שדה שונים לתשובה
            const token = data.token || data.accessToken || data.jwt;
            if (!token) {
                throw new Error("ההתחברות נכשלה — לא התקבל טוקן.");
            }

            setToken(token);

            // חזרה לדף שממנו הגיעו, או לחיפוש
            const returnTo = sessionStorage.getItem("returnTo") || "index.html";
            sessionStorage.removeItem("returnTo");
            window.location.href = returnTo;

        } catch (error) {
            showMessage("loginMessage",
                error.status === 401
                    ? "אימייל או סיסמה שגויים."
                    : error.message);
        }
    });
}

// ===== עדכון ניווט בכל דף =====
// "התחברות" ו"ההזמנות שלי" מתחלפות ביניהן; במקום שהקישור הנוכחי תמיד משמש ככפתור הגלולה.
function updateNav() {
    const navLogin = document.getElementById("navLogin");
    const navLogout = document.getElementById("navLogout");
    const navMyBookings = document.getElementById("navMyBookings");
    const navAdmin = document.getElementById("navAdmin");
    const navAdminBookings = document.getElementById("navAdminBookings");

    if (!navLogin) return;

    if (isLoggedIn()) {
        navLogin.hidden = true;
        if (navLogout) navLogout.hidden = false;
        if (navMyBookings) navMyBookings.hidden = false;

        // חשיפת קישורי הניהול רק למנהל
        let isAdmin = false;
        try {
            const payload = JSON.parse(atob(getToken().split(".")[1]));
            isAdmin = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] === "Admin";
        } catch {
            isAdmin = false;
        }

        if (navAdmin) navAdmin.hidden = !isAdmin;
        if (navAdminBookings) navAdminBookings.hidden = !isAdmin;
    } else {
        navLogin.hidden = false;
        if (navLogout) navLogout.hidden = true;
        if (navMyBookings) navMyBookings.hidden = true;
        if (navAdmin) navAdmin.hidden = true;
        if (navAdminBookings) navAdminBookings.hidden = true;
    }
}

// "התנתקות" — התנהגות ברירת מחדל היא href="#" (זינוק לראש העמוד). מבטלים אותה,
// מוחקים טוקן ומעבירים לדף הבית. האזנה ממוקדת על הקישור עצמו — פעם אחת בלבד.
const navLogoutLink = document.getElementById("navLogout");
navLogoutLink?.addEventListener("click", event => {
    event.preventDefault();
    clearToken();
    window.location.href = "index.html";
});

// ריצה מיידית (הכותרת כבר במידע) + סינון כפול כשהדף מתרענן חזרה מהמטמון
updateNav();
window.addEventListener("pageshow", updateNav);
