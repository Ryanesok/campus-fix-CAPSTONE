import { 
    loadFacilityModel, 
    predictFacilityFromImage 
} from '../ai-module/index.js';

// Base URL Backend API Python
const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", async () => {
    
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

    let aiModelReady = false;
    try {
        console.log("Memuat model AI...");
        await loadFacilityModel('./model/tfjs_graph_model/model.json');
        console.log("Model AI berhasil dimuat!");
        aiModelReady = true;
    } catch (error) {
        console.warn("Model AI belum tersedia atau path salah. Prediksi AI otomatis dilewati.", error);
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

    // --- LOGIKA UNGGAH FOTO & PREDIKSI AI ---
    fotoInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Reset UI saat foto baru dipilih
        kategoriContainer.classList.add("d-none");
        detailContainer.classList.add("d-none");
        alertSaranAI.classList.add("d-none");
        kategoriFinal.value = "";
        
        // Tampilkan foto di browser
        const objectUrl = URL.createObjectURL(file);
        previewImage.src = objectUrl;
        previewContainer.classList.remove("d-none");
        
        // Prediksi dijalankan SETELAH gambar selesai dimuat di HTML
        previewImage.onload = async () => {
            
            // JIKA MODEL AI GAGAL DIMUAT
            if (!aiModelReady) {
                alertSaranAI.className = "alert alert-custom alert-warning py-3 px-4 mb-3 shadow-sm";
                teksSaranAI.innerHTML = `<strong>Peringatan Sistem:</strong> Modul AI belum terpasang. Silakan pilih kategori secara manual.`;
                alertSaranAI.classList.remove("d-none");
                
                kategoriContainer.classList.remove("d-none");
                detailContainer.classList.remove("d-none");
                return;
            }

            // JIKA MODEL AI ADA, LANJUT PREDICT
            loadingAI.classList.remove("d-none");

            try {
                // Memanggil fungsi prediksi utama dari facility_predictor.js
                const hasilPrediksi = await predictFacilityFromImage(previewImage);
                
                // Asumsi modul mereturn object dengan struktur { category, confidence }
                const category = hasilPrediksi.predictedCategory;
                const confidence = hasilPrediksi.topScore;
                const persen = (confidence * 100).toFixed(0);

                teksSaranAI.innerHTML = `Saran AI: <strong>${category}</strong> (Keyakinan: ${persen}%)`;
                
                // threshold 60% sebagai batas keyakinan
                if (confidence >= 0.6) {
                    alertSaranAI.className = "alert alert-custom alert-success py-3 px-4 mb-3 shadow-sm";
                    kategoriFinal.value = category; 
                } else {
                    alertSaranAI.className = "alert alert-custom alert-warning py-3 px-4 mb-3 shadow-sm";
                    teksSaranAI.innerHTML += `<br><small class="text-dark">Sistem kurang yakin. Mohon periksa kembali pilihan kategori di bawah.</small>`;
                    kategoriFinal.value = ""; 
                }

                alertSaranAI.classList.remove("d-none");

            } catch (error) {
                console.error("Kesalahan Prediksi AI:", error);
                alertSaranAI.className = "alert alert-custom alert-danger py-3 px-4 mb-3 shadow-sm";
                teksSaranAI.innerHTML = `Gagal memproses gambar dengan AI. Silakan pilih kategori secara manual.`;
                alertSaranAI.classList.remove("d-none");
            } finally {
                loadingAI.classList.add("d-none");
                kategoriContainer.classList.remove("d-none");
                detailContainer.classList.remove("d-none");
            }
        };
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
                previewContainer.classList.add("d-none");
                kategoriContainer.classList.add("d-none");
                detailContainer.classList.add("d-none");
                alertSaranAI.classList.add("d-none");
            } else {
                const errorData = await response.json();
                alert(`Gagal mengirim laporan: ${errorData.message || 'Kesalahan server'}`);
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