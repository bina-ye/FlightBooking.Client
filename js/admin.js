// טופס הוספת טיסה — למנהל בלבד
const flightForm = document.getElementById("flightForm");
const adminMessage = document.getElementById("adminMessage");
const adminNotice = document.getElementById("adminNotice");
const navAdmin = document.getElementById("navAdmin");

// חילוץ התפקיד מתוך ה-JWT
function getUserRole() {
    const token = getToken();
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || null;
    } catch {
        return null;
    }
}

function showAdminMessage(text, type = "error") {
    adminMessage.textContent = text;
    adminMessage.classList.remove("message-error", "message-info", "message-success");
    if (text) adminMessage.classList.add(`message-${type}`);
    adminMessage.style.display = text ? "block" : "none";
}

// אתחול — הצגת הטופס רק למנהל
(function init() {
    if (getUserRole() !== "Admin") {
        adminNotice.style.display = "block";
        flightForm.hidden = true;
        return;
    }

    adminNotice.style.display = "none";
    flightForm.hidden = false;
    if (navAdmin) navAdmin.hidden = false;
})();

// שליחת הטופס
flightForm.addEventListener("submit", async event => {
    event.preventDefault();
    showAdminMessage("");

    const flightNumber = document.getElementById("flightNumber").value.trim().toUpperCase();
    const originCode = document.getElementById("originCode").value.trim().toUpperCase();
    const destinationCode = document.getElementById("destinationCode").value.trim().toUpperCase();
    const departureTime = document.getElementById("departureTime").value;
    const arrivalTime = document.getElementById("arrivalTime").value;
    const price = document.getElementById("price").value;
    const gate = document.getElementById("gate").value.trim();
    const aircraftType = document.getElementById("aircraftType").value.trim();

    if (originCode === destinationCode) {
        showAdminMessage("קוד המוצא וקוד היעד חייבים להיות שונים.");
        return;
    }

    // בדיקות מקדימות שתואמות את השרת — כדי לקבל הודעה ברורה ולא 400 סתמי
    const dep = departureTime ? new Date(departureTime) : null;
    const arr = arrivalTime ? new Date(arrivalTime) : null;

    if (!dep || Number.isNaN(dep.getTime()) || !arr || Number.isNaN(arr.getTime())) {
        showAdminMessage("יש להזין זמן המראה וזמן נחיתה תקינים.");
        return;
    }
    if (dep <= new Date()) {
        showAdminMessage("זמן ההמראה חייב להיות בעתיד.");
        return;
    }
    if (arr <= dep) {
        showAdminMessage("זמן הנחיתה חייב להיות אחרי זמן ההמראה.");
        return;
    }
    if (!Number.isFinite(Number(price)) || Number(price) < 1 || Number(price) > 100000) {
        showAdminMessage("המחיר חייב להיות בין 1 ל-100,000 ש\"ח.");
        return;
    }

    const payload = {
        flightNumber,
        originCode,
        destinationCode,
        // datetime-local מחזיר שעה מקומית; dep/arr נבנו ואומתו למעלה
        departureTime: dep.toISOString(),
        arrivalTime: arr.toISOString(),
        price: Number(price),
        gate,
        aircraftType
    };

    try {
        const created = await apiFetch("/flights", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showAdminMessage(
            `הטיסה ${created.flightNumber} נוצרה בהצלחה (מזהה ${created.id}), עם ${created.availableSeatsCount} מושבים.`,
            "success");

        flightForm.reset();

    } catch (error) {
        if (error.status === 409) {
            showAdminMessage(`מספר הטיסה ${flightNumber} כבר קיים במערכת.`);
        } else if (error.status === 403) {
            showAdminMessage("אין לך הרשאת מנהל.");
        } else if (error.status === 400) {
            // 400 יכול לכלול מספר שגיאות ולידציה — מציגים את כולן, לא רק את הראשונה
            const body = error.body;
            const details = body?.errors
                ? Object.entries(body.errors)
                    .map(([field, msgs]) => `${field}: ${[].concat(msgs).join(", ")}`)
                    .join(" · ")
                : null;
            showAdminMessage(details || error.message);
            console.warn("400 ValidationProblem:", body);
        } else {
            showAdminMessage("אירעה שגיאה. נסו שוב או פנו לתמיכה.");
            console.error(error);
        }
    }
});