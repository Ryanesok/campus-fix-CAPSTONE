// frontend/js/app.js
const LOGIN_PAGE_URL = "pages/login.html";

function cekSesiKedaluwarsa() {
    const token = localStorage.getItem("campusfix_token");
    if (!token) return true;

    let expMs = Number(localStorage.getItem("campusfix_token_exp") || 0);
    try {
        const parts = token.split(".");
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
            if (typeof payload.exp === "number") expMs = payload.exp * 1000;
        }
    } catch {}

    return expMs > 0 && Date.now() >= (expMs - 10000);
}

function paksaLogoutSesiHabis() {
    localStorage.removeItem("campusfix_token");
    localStorage.removeItem("campusfix_role");
    localStorage.removeItem("campusfix_token_exp");
    window.location.href = `${LOGIN_PAGE_URL}?expired=1`;
}

// Jalankan pengecekan langsung saat halaman dibuka, setiap 15 detik, dan saat tab kembali aktif
if (cekSesiKedaluwarsa()) {
    paksaLogoutSesiHabis();
}
setInterval(() => {
    if (cekSesiKedaluwarsa()) paksaLogoutSesiHabis();
}, 15000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && cekSesiKedaluwarsa()) paksaLogoutSesiHabis();
});

// Base URL Backend API Python
const API_BASE_URL = "http://127.0.0.1:8000";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

document.addEventListener("DOMContentLoaded", () => {

    // --- PENGECEKAN AUTENTIKASI ---
    const token = localStorage.getItem("campusfix_token");
    const role = localStorage.getItem("campusfix_role");

    if (!token) {
        window.location.href = LOGIN_PAGE_URL;
        return;
    }

    if (role === "admin") {
        window.location.href = "pages/admin.html";
        return;
    }

    // Helper untuk menangani sesi habis (401)
    function handleUnauthorized() {
        paksaLogoutSesiHabis();
    }

    // --- LOGIKA LOGOUT ---
    const btnLogout = document.getElementById("btnLogoutUtama");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("campusfix_token");
            localStorage.removeItem("campusfix_role");
            localStorage.removeItem("campusfix_token_exp");
            window.location.href = LOGIN_PAGE_URL;
        });
    }

    // --- REFERENSI ELEMEN FORM ---
    const fotoInput = document.getElementById("fotoFasilitas");
    const previewContainer = document.getElementById("previewContainer");
    const previewImage = document.getElementById("previewImage");
    const loadingAI = document.getElementById("loadingAI");

    const kategoriContainer = document.getElementById("kategoriContainer");
    const alertSaranAI = document.getElementById("alertSaranAI");
    const teksSaranAI = document.getElementById("teksSaranAI");
    const kategoriFinal = document.getElementById("kategoriFinal");

    const detailContainer = document.getElementById("detailContainer");
    const formLaporan = document.getElementById("formLaporan");
    const btnKirim = document.getElementById("btnKirim");

    // State aplikasi
    let lastAiCategory = null;
    let currentObjectUrl = null;

    // --- LOGIKA UNGGAH FOTO & PREDIKSI AI ---
    fotoInput.addEventListener("change", async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validasi format & ukuran file sebelum diproses
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            alert("Format foto tidak didukung. Gunakan file JPEG, PNG, atau WebP.");
            fotoInput.value = "";
            return;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            alert("Ukuran foto melebihi batas maksimum 5 MB.");
            fotoInput.value = "";
            return;
        }

        // Reset UI & state saat foto baru dipilih
        kategoriContainer.classList.add("d-none");
        detailContainer.classList.add("d-none");
        alertSaranAI.classList.add("d-none");
        kategoriFinal.value = "";
        lastAiCategory = null;

        // Tampilkan preview foto di browser
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
        }
        currentObjectUrl = URL.createObjectURL(file);
        previewImage.src = currentObjectUrl;
        previewContainer.classList.remove("d-none");
        loadingAI.classList.remove("d-none");

        // Kirim foto ke backend
        try {
            const formData = new FormData();
            formData.append("photo", file);

            const response = await fetch(`${API_BASE_URL}/api/predictions`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const result = await response.json();
            const prediction = result.prediction || {};
            const rawCategory = (prediction.category || "").trim();
            const confidence = typeof prediction.confidence === "number" ? prediction.confidence : 0;
            const persen = (confidence * 100).toFixed(0);

            const displayLabelMap = {
                "AC": "AC",
                "KURSI": "Kursi",
                "LAMPU": "Lampu",
                "PROYEKTOR": "Proyektor"
            };

            const upperCategory = rawCategory.toUpperCase();
            const displayLabel = displayLabelMap[upperCategory] || "";

            if (displayLabel) {
                lastAiCategory = upperCategory;
            }

            teksSaranAI.innerHTML = `Saran AI: <strong>${displayLabel || rawCategory}</strong> (Keyakinan: ${persen}%)`;


            if (confidence >= 0.7 && displayLabel) {
                alertSaranAI.className = "alert alert-custom alert-ds-success py-3 px-3 mb-3";
                const hasUpperOption = Boolean(kategoriFinal.querySelector(`option[value="${upperCategory}"]`));
                kategoriFinal.value = hasUpperOption ? upperCategory : displayLabel;
            } else {
                alertSaranAI.className = "alert alert-custom alert-ds-warning py-3 px-3 mb-3";
                teksSaranAI.innerHTML += `<br><span style="font-size: 12px; color: var(--ds-text-main);">Sistem kurang yakin. Mohon periksa kembali pilihan kategori di bawah.</span>`;
                kategoriFinal.value = "";
            }

            alertSaranAI.classList.remove("d-none");
        } catch (error) {
            console.error("Kesalahan Prediksi AI:", error);
            alertSaranAI.className = "alert alert-custom alert-ds-danger py-3 px-3 mb-3";
            teksSaranAI.innerHTML = `Gagal memproses gambar dengan AI. Silakan pilih kategori secara manual.`;
            alertSaranAI.classList.remove("d-none");
        } finally {
            loadingAI.classList.add("d-none");
            kategoriContainer.classList.remove("d-none");
            detailContainer.classList.remove("d-none");
        }
    });

    // --- LOGIKA KIRIM LAPORAN KE BACKEND ---
    formLaporan.addEventListener("submit", async function (e) {
        e.preventDefault();

        const file = fotoInput.files[0];
        const kategori = kategoriFinal.value;
        const lokasi = document.getElementById("lokasi").value.trim();
        const deskripsi = document.getElementById("deskripsi").value.trim();

        if (!file || !kategori || !lokasi || !deskripsi) {
            alert("Harap lengkapi semua kolom yang wajib diisi.");
            return;
        }

        if (lokasi.length > 255) {
            alert("Lokasi maksimal 255 karakter.");
            return;
        }

        if (deskripsi.length > 5000) {
            alert("Deskripsi kerusakan maksimal 5000 karakter.");
            return;
        }

        const formData = new FormData();
        formData.append("photo", file);
        formData.append("category", kategori.toUpperCase());
        if (lastAiCategory) {
            formData.append("ai_category", lastAiCategory);
        }
        formData.append("location", lokasi);
        formData.append("description", deskripsi);

        btnKirim.disabled = true;
        btnKirim.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Mengirim...`;

        try {
            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (response.status === 401) {
                handleUnauthorized();
                return;
            }

            if (response.ok) {
                alert("Laporan berhasil dikirim! Terima kasih.");
                formLaporan.reset();
                lastAiCategory = null;
                if (currentObjectUrl) {
                    URL.revokeObjectURL(currentObjectUrl);
                    currentObjectUrl = null;
                }
                previewContainer.classList.add("d-none");
                kategoriContainer.classList.add("d-none");
                detailContainer.classList.add("d-none");
                alertSaranAI.classList.add("d-none");
            } else {
                const errorData = await response.json();
                const detailMsg = Array.isArray(errorData.detail)
                    ? errorData.detail.map(err => `${err.loc ? err.loc.join(".") + ": " : ""}${err.msg}`).join("\n")
                    : (errorData.detail || errorData.message || "Kesalahan server");
                alert(`Gagal mengirim laporan:\n${detailMsg}`);
            }
        } catch (error) {
            console.error("Error API Laporan:", error);
            alert("Terjadi kesalahan jaringan. Pastikan backend server sedang berjalan.");
        } finally {
            btnKirim.disabled = false;
            btnKirim.innerHTML = `Kirim Laporan <i class="bi bi-send ms-1"></i>`;
        }
    });
});