// frontend/js/login.js
const API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_SESSION_MS = 60 * 60 * 1000; // Fallback 1 jam jika token tidak memiliki claim exp

function parseJwtExpMs(token) {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        const payload = JSON.parse(jsonPayload);
        return typeof payload.exp === "number" ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

function clearAuthSession() {
    localStorage.removeItem("campusfix_token");
    localStorage.removeItem("campusfix_role");
    localStorage.removeItem("campusfix_token_exp");
}

function isStoredSessionExpired() {
    const token = localStorage.getItem("campusfix_token");
    if (!token) return true;

    const jwtExp = parseJwtExpMs(token);
    const savedExp = Number(localStorage.getItem("campusfix_token_exp") || 0);
    const expMs = jwtExp || savedExp;

    if (!expMs) return false;
    return Date.now() >= (expMs - 10000);
}

function extractApiError(data, fallbackMsg) {
    if (!data) return fallbackMsg;
    if (Array.isArray(data.detail)) {
        return data.detail.map(err => err.msg).join(", ");
    }
    return data.detail || data.message || fallbackMsg;
}

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    const formRegister = document.getElementById("formRegister");
    const loginAlert = document.getElementById("loginAlert");

    // --- CEK STATUS SESI SAAT HALAMAN LOGIN DIBUKA ---
    const params = new URLSearchParams(window.location.search);
    const existingToken = localStorage.getItem("campusfix_token");
    const existingRole = localStorage.getItem("campusfix_role");

    if (params.get("expired") === "1") {
        clearAuthSession();
        window.history.replaceState({}, document.title, window.location.pathname);
        loginAlert.className = "alert alert-ds alert-warning py-2 text-center";
        loginAlert.textContent = "Sesi login Anda telah berakhir karena tidak aktif terlalu lama. Silakan masuk kembali.";
        loginAlert.classList.remove("d-none");
    } else if (existingToken) {
        if (isStoredSessionExpired()) {
            clearAuthSession();
            loginAlert.className = "alert alert-ds alert-warning py-2 text-center";
            loginAlert.textContent = "Sesi login Anda telah berakhir. Silakan masuk kembali.";
            loginAlert.classList.remove("d-none");
        } else {
            window.location.href = existingRole === "admin" ? "admin.html" : "../index.html";
            return;
        }
    }

    // --- LOGIC FORM LOGIN ---
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const btnLogin = document.getElementById("btnLogin");

        btnLogin.disabled = true;
        btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa...`;
        loginAlert.classList.add("d-none");

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                const token = data.token || data.access_token;
                const role = (data.user && data.user.role) || data.role || "pelapor";
                const expMs = parseJwtExpMs(token)
                    || (typeof data.expires_in === "number" ? Date.now() + data.expires_in * 1000 : Date.now() + DEFAULT_SESSION_MS);

                localStorage.setItem("campusfix_token", token);
                localStorage.setItem("campusfix_role", role);
                localStorage.setItem("campusfix_token_exp", String(expMs));
                
                loginAlert.className = "alert alert-ds alert-success py-2 text-center";
                loginAlert.textContent = "Login berhasil! Mengalihkan...";
                loginAlert.classList.remove("d-none");

                setTimeout(() => {
                    if (role === "admin") {
                        window.location.href = "admin.html";
                    } else {
                        window.location.href = "../index.html";
                    }
                }, 800);
            } else {
                loginAlert.className = "alert alert-ds alert-danger py-2 text-center";
                loginAlert.textContent = extractApiError(data, "Email atau password salah!");
                loginAlert.classList.remove("d-none");
            }
        } catch (error) {
            console.error("Error Login:", error);
            loginAlert.className = "alert alert-ds alert-danger py-2 text-center";
            loginAlert.textContent = "Gagal terhubung ke server. Pastikan backend aktif.";
            loginAlert.classList.remove("d-none");
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = "Masuk";
        }
    });

    // --- LOGIC FORM REGISTRASI ---
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nama = document.getElementById("regNama").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPassword").value;
        const btnRegister = document.getElementById("btnRegister");
        const registerAlert = document.getElementById("registerAlert");

        btnRegister.disabled = true;
        btnRegister.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Memproses...`;
        registerAlert.classList.add("d-none");

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nama, email, password, role: "pelapor" })
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                registerAlert.className = "alert alert-ds alert-success py-2 text-center";
                registerAlert.innerHTML = `Pendaftaran berhasil! Silakan <a href="#" style="color: #155E38; font-weight: 700;" onclick="document.getElementById('login-tab').click()">Masuk di sini</a>.`;
                registerAlert.classList.remove("d-none");
                formRegister.reset();
            } else {
                registerAlert.className = "alert alert-ds alert-danger py-2 text-center";
                registerAlert.textContent = extractApiError(data, "Gagal mendaftar. Email mungkin sudah digunakan.");
                registerAlert.classList.remove("d-none");
            }
        } catch (error) {
            console.error("Error Register:", error);
            registerAlert.className = "alert alert-ds alert-danger py-2 text-center";
            registerAlert.textContent = "Gagal terhubung ke server.";
            registerAlert.classList.remove("d-none");
        } finally {
            btnRegister.disabled = false;
            btnRegister.textContent = "Daftar Sekarang";
        }
    });
});