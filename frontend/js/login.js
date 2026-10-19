const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    const formRegister = document.getElementById("formRegister");
    
    // --- LOGIC FORM LOGIN ---
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        const btnLogin = document.getElementById("btnLogin");
        const loginAlert = document.getElementById("loginAlert");

        // UI Loading State
        btnLogin.disabled = true;
        btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Memeriksa...`;
        loginAlert.classList.add("d-none");

        try {
            // Hit Endpoint Login
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Asumsi Backend mengembalikan token & data user (termasuk role)
                localStorage.setItem("campusfix_token", data.token);
                localStorage.setItem("campusfix_role", data.user.role); // "pelapor" atau "admin"
                
                // Tampilkan sukses
                loginAlert.className = "alert alert-success py-2 text-center small rounded-3";
                loginAlert.textContent = "Login berhasil! Mengalihkan...";
                loginAlert.classList.remove("d-none");

                // Redirect berdasarkan peran sesuai Dokumen Project Plan
                setTimeout(() => {
                    if (data.user.role === "admin") {
                        window.location.href = "admin.html"; // Ke dashboard admin
                    } else {
                        window.location.href = "../index.html"; // Ke form laporan (beranda pelapor)
                    }
                }, 1000);
            } else {
                // Jika password/email salah
                loginAlert.className = "alert alert-danger py-2 text-center small rounded-3";
                loginAlert.textContent = data.message || "Email atau password salah!";
                loginAlert.classList.remove("d-none");
            }
        } catch (error) {
            console.error("Error Login:", error);
            loginAlert.className = "alert alert-danger py-2 text-center small rounded-3";
            loginAlert.textContent = "Gagal terhubung ke server. Pastikan backend aktif.";
            loginAlert.classList.remove("d-none");
        } finally {
            btnLogin.disabled = false;
            btnLogin.textContent = "Masuk";
        }
    });

    // --- LOGIC FORM REGISTRASI  ---
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nama = document.getElementById("regNama").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;
        const btnRegister = document.getElementById("btnRegister");
        const registerAlert = document.getElementById("registerAlert");

        // UI Loading State
        btnRegister.disabled = true;
        btnRegister.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Memproses...`;
        registerAlert.classList.add("d-none");

        try {
            // Hit Endpoint Register
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nama, email, password, role: "pelapor" }) // Paksa role pelapor
            });

            const data = await response.json();

            if (response.ok) {
                // Tampilkan sukses
                registerAlert.className = "alert alert-success py-2 text-center small rounded-3";
                registerAlert.innerHTML = `Pendaftaran berhasil! Silakan <a href="#" onclick="document.getElementById('login-tab').click()">Masuk di sini</a>.`;
                registerAlert.classList.remove("d-none");
                formRegister.reset();
            } else {
                registerAlert.className = "alert alert-danger py-2 text-center small rounded-3";
                registerAlert.textContent = data.message || "Gagal mendaftar. Email mungkin sudah digunakan.";
                registerAlert.classList.remove("d-none");
            }
        } catch (error) {
            console.error("Error Register:", error);
            registerAlert.className = "alert alert-danger py-2 text-center small rounded-3";
            registerAlert.textContent = "Gagal terhubung ke server.";
            registerAlert.classList.remove("d-none");
        } finally {
            btnRegister.disabled = false;
            btnRegister.textContent = "Daftar Sekarang";
        }
    });
});