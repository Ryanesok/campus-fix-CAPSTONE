import { 
    loadFacilityModel, 
    predictFacilityFromImage 
} from '../ai-module/index.js';

// Base URL Backend API Python
const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    
    // --- PENGECEKAN AUTENTIKASI ---
    const token = localStorage.getItem("campusfix_token");
    const role = localStorage.getItem("campusfix_role");

    if (!token) {
        window.location.href = "pages/login.html";
        return; 
    }

    if (role === "admin") {
        window.location.href = "pages/admin.html";
        return;
    }

    // --- LOGIKA LOGOUT ---
    const btnLogout = document.getElementById("btnLogoutUtama");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("campusfix_token");
            localStorage.removeItem("campusfix_role");
            window.location.href = "pages/login.html";
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

    let lastAiCategory = null;

    // --- LOGIKA UNGGAH FOTO & PEMANGGILAN API PREDIKSI AI DARI BACKEND ---
    fotoInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Reset UI saat foto baru dipilih
        kategoriContainer.classList.add("d-none");
        detailContainer.classList.add("d-none");
        alertSaranAI.classList.add("d-none");
        kategoriFinal.value = "";
        lastAiCategory = null;
        
        // Tampilkan foto di browser
        const objectUrl = URL.createObjectURL(file);
        previewImage.src = objectUrl;
        previewContainer.classList.remove("d-none");
        loadingAI.classList.remove("d-none");

        // Kirim foto ke API Backend untuk inferensi model AI
        const formData = new FormData();
        formData.append("photo", file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/predictions`, {
                method: "POST",
                headers: token ? { "Authorization": `Bearer ${token}` } : {},
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                const prediction = data.prediction || {};
                const rawCategory = prediction.category || "";
                const confidence = typeof prediction.confidence === "number" ? prediction.confidence : 0;
                const persen = Math.round(confidence * 100);

                // Sinkronisasi pemetaan kategori dengan opsi form dropdown
                const categoryMap = {
                    "AC": "AC",
                    "KURSI": "Kursi",
                    "LAMPU": "Lampu",
                    "PROYEKTOR": "Proyektor",
                    "Kursi": "Kursi",
                    "Lampu": "Lampu",
                    "Proyektor": "Proyektor"
                };
                const matchedCategory = categoryMap[rawCategory] || categoryMap[rawCategory.toUpperCase()] || rawCategory;
                lastAiCategory = matchedCategory;

                teksSaranAI.innerHTML = `Saran AI: <strong>${matchedCategory}</strong> (Keyakinan: ${persen}%)`;
                
                // Jika confidence >= 60%, sistem memilih otomatis
                if (confidence >= 0.6) {
                    alertSaranAI.className = "alert alert-custom alert-success py-3 px-4 mb-3 shadow-sm";
                    kategoriFinal.value = matchedCategory; 
                } else {
                    alertSaranAI.className = "alert alert-custom alert-warning py-3 px-4 mb-3 shadow-sm";
                    teksSaranAI.innerHTML += `<br><small class="text-dark">Sistem kurang yakin. Mohon periksa kembali pilihan kategori di bawah.</small>`;
                    kategoriFinal.value = ""; 
                }

                alertSaranAI.classList.remove("d-none");
            } else {
                throw new Error(`Server merespons status ${response.status}`);
            }

        } catch (error) {
            console.warn("Gagal memanggil API Prediksi AI:", error);
            alertSaranAI.className = "alert alert-custom alert-warning py-3 px-4 mb-3 shadow-sm";
            teksSaranAI.innerHTML = `Layanan AI sedang tidak tersedia. Silakan pilih kategori secara manual.`;
            alertSaranAI.classList.remove("d-none");
        } finally {
            loadingAI.classList.add("d-none");
            kategoriContainer.classList.remove("d-none");
            detailContainer.classList.remove("d-none");
        }
    });

    // --- LOGIKA KIRIM LAPORAN KE BACKEND ---
    formLaporan.addEventListener("submit", async function(e) {
        e.preventDefault();
        
        const file = fotoInput.files[0];
        const kategori = kategoriFinal.value;
        const lokasi = document.getElementById("lokasi").value.trim();
        const deskripsi = document.getElementById("deskripsi").value.trim();

        if (!file || !kategori || !lokasi || !deskripsi) {
            alert("Harap lengkapi semua kolom yang wajib diisi.");
            return;
        }

        const formData = new FormData();
        formData.append("photo", file);
        formData.append("category", kategori);
        if (lastAiCategory) {
            formData.append("ai_category", lastAiCategory);
        }
        formData.append("location", lokasi);
        formData.append("description", deskripsi);

        btnKirim.disabled = true;
        btnKirim.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengirim...`;

        try {
            const response = await fetch(`${API_BASE_URL}/api/reports`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}` 
                },
                body: formData
            });

            if (response.ok) {
                alert("Laporan berhasil dikirim! Terima kasih.");
                formLaporan.reset();
                lastAiCategory = null;
                previewContainer.classList.add("d-none");
                kategoriContainer.classList.add("d-none");
                detailContainer.classList.add("d-none");
                alertSaranAI.classList.add("d-none");
            } else {
                const errorData = await response.json();
                alert(`Gagal mengirim laporan: ${errorData.detail || errorData.message || 'Kesalahan server'}`);
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
