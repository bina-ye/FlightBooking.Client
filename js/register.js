const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        showMessage("registerMessage", "");

        if (password.length < 8) {
            showMessage("registerMessage", "הסיסמה חייבת להכיל לפחות 8 תווים.");
            return;
        }

        const submitBtn = registerForm.querySelector("button[type=submit]");
        submitBtn.disabled = true;

        try {
            const data = await apiFetch("/users", {
                method: "POST",
                body: JSON.stringify({ fullName, email, password })
            });

            // הרישום מחזיר AuthResponse עם טוקן — מתחברים אוטומטית
            const token = data.token || data.accessToken;
            if (token) {
                setToken(token);
                window.location.href = "index.html";
            } else {
                window.location.href = "login.html";
            }

        } catch (error) {
            if (error.status === 409) {
                showMessage("registerMessage", "כתובת האימייל כבר רשומה במערכת.");
            } else {
                showMessage("registerMessage", error.message);
            }
            submitBtn.disabled = false;
        }
    });
}

// עדכון ניווט (זהה ל-auth.js)
(function updateNav() {
    const navLogin = document.getElementById("navLogin");
    const navLogout = document.getElementById("navLogout");
    const navMyBookings = document.getElementById("navMyBookings");
    if (!navLogin) return;

    if (isLoggedIn()) {
        navLogin.hidden = true;
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