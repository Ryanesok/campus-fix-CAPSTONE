// Base URL Backend API Python
const API_BASE_URL = "http://127.0.0.1:8000";

// Variabel Model TF.js
let aiModel = null;
const KELAS_FASILITAS = ["AC", "Kursi", "Lampu", "Proyektor"];

document.addEventListener("DOMContentLoaded", async () => {
    
    // --- 1. PENGECEKAN AUTENTIKASI ---
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

    // --- 2. LOGIKA LOGOUT ---
    const btnLogout = document.getElementById("btnLogoutUtama");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("campusfix_token");
            localStorage.removeItem("campusfix_role");
            window.location.href = "pages/login.html";
        });
    }

    // --- 3. MUAT MODEL TENSORFLOW.JS (DI BROWSER) ---
    try {
        aiModel = await tf.loadLayersModel('./assets/model/model.json');
        console.log("Model AI TF.js berhasil dimuat!");
    } catch (error) {
        console.warn("Model AI belum tersedia atau path salah. Prediksi AI otomatis dilewati.", error);
    }

    // --- 4. REFERENSI ELEMEN FORM ---
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

    // --- 5. LOGIKA UNGGAH FOTO & PREDIKSI AI (OFFLINE DI BROWSER) ---
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
            
            // JIKA MODEL AI GAGAL DIMUAT (Misal: File model.json belum ada)
            if (!aiModel) {
                alertSaranAI.className = "alert alert-custom alert-warning py-3 px-4 mb-3 shadow-sm";
                teksSaranAI.innerHTML = `<strong>Peringatan Sistem:</strong> Modul AI belum terpasang. Silakan pilih kategori secara manual.`;
                alertSaranAI.classList.remove("d-none");
                
                kategoriContainer.classList.remove("d-none");
                detailContainer.classList.remove("d-none");
                return;
            }

            // JIKA MODEL AI ADA, LANJUT PREDIKSI
            loadingAI.classList.remove("d-none");

            try {
                const tensor = tf.browser.fromPixels(previewImage)
                    .resizeNearestNeighbor([224, 224])
                    .toFloat()
                    .expandDims();

                const predictions = await aiModel.predict(tensor).data();
                
                const highestIndex = predictions.indexOf(Math.max(...predictions));
                const category = KELAS_FASILITAS[highestIndex];
                const confidence = predictions[highestIndex];
                const persen = (confidence * 100).toFixed(0);

                teksSaranAI.innerHTML = `Saran AI: <strong>${category}</strong> (Keyakinan: ${persen}%)`;
                
                if (confidence >= 0.6) {
                    alertSaranAI.className = "alert alert-custom alert-success py-3 px-4 mb-3 shadow-sm";
                    kategoriFinal.value = category; 
                } else {
                    alertSaranAI.className = "alert alert-custom alert-warning py-3 px-4 mb-3 shadow-sm";
                    teksSaranAI.innerHTML += `<br><small class="text-dark">Sistem kurang yakin. Mohon periksa kembali pilihan kategori di bawah.</small>`;
                    kategoriFinal.value = ""; 
                }

                alertSaranAI.classList.remove("d-none");
                tensor.dispose();

            } catch (error) {
                console.error("TF.js Error:", error);
                alertSaranAI.className = "alert alert-custom alert-danger py-3 px-4 mb-3 shadow-sm";
                teksSaranAI.innerHTML = `Gagal memproses gambar. Silakan pilih kategori secara manual.`;
                alertSaranAI.classList.remove("d-none");
            } finally {
                loadingAI.classList.add("d-none");
                kategoriContainer.classList.remove("d-none");
                detailContainer.classList.remove("d-none");
            }
        };
    });

    // --- 6. LOGIKA KIRIM LAPORAN KE BACKEND API PYTHON ---
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