// Base URL Backend API Python
const API_BASE_URL = "http://127.0.0.1:8000";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

    // Helper untuk menangani sesi habis (401)
    function handleUnauthorized() {
        localStorage.removeItem("campusfix_token");
        localStorage.removeItem("campusfix_role");
        alert("Sesi login Anda telah berakhir. Silakan login kembali.");
        window.location.href = "pages/login.html";
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

    // --- LOGIKA UNGGAH FOTO & PREDIKSI AI ---
    let lastAiCategory = null; // Variabel untuk menyimpan kategori terakhir dari AI
    fotoInput.addEventListener("change", function (e) {
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

        // Reset UI saat foto baru dipilih
        lastAiCategory = null;
        kategoriContainer.classList.add("d-none");
        detailContainer.classList.add("d-none");
        alertSaranAI.classList.add("d-none");
        kategoriFinal.value = "";

        // Tampilkan foto di browser
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
        }
        currentObjectUrl = URL.createObjectURL(file);
        previewImage.src = currentObjectUrl;
        previewContainer.classList.remove("d-none");

        // Prediksi dijalankan SETELAH gambar selesai dimuat di HTML
        previewImage.onload = async () => {
            // JALANKAN PREDIKSI KE BACKEND SERVER-SIDE AI
            loadingAI.classList.remove("d-none");
            try {
                const formData = new FormData();
                formData.append("photo", file);  // `file` sudah tersedia dari e.target.files[0]
                const response = await fetch(`${API_BASE_URL}/api/predictions`, {
                    method: "POST",
                    body: formData
                    // Tidak perlu Authorization header — endpoint /api/predictions tidak memerlukan auth
                    // Tidak perlu Content-Type — browser set multipart boundary otomatis
                });
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }
                const result = await response.json();
                // result.prediction = { category: "LAMPU", confidence: 0.92 }
                const category = result.prediction.category;
                const confidence = result.prediction.confidence;
                const persen = (confidence * 100).toFixed(0);

                lastAiCategory = category; // Simpan kategori terakhir dari AI
                teksSaranAI.innerHTML = `Saran AI: <strong>${category}</strong> (Keyakinan: ${persen}%)`;
                if (confidence >= 0.6) {
                    alertSaranAI.className = "alert alert-custom alert-success py-3 px-4 mb-3 shadow-sm";
                    const matchedOption = Array.from(kategoriFinal.options).find(
                        opt => opt.value.toLowerCase() === category.toLowerCase()
                    );
                    kategoriFinal.value = matchedOption ? matchedOption.value : "";
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

        // Kirim field 
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("final_category", kategori.toUpperCase());
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
                    ? errorData.detail.map(err => err.msg).join(", ")
                    : (errorData.detail || errorData.message || "Kesalahan server");
                alert(`Gagal mengirim laporan: ${detailMsg}`);
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