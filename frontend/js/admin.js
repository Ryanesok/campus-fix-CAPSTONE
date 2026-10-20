const API_BASE_URL = "http://127.0.0.1:8000";

let semuaDataLaporan = []; 

document.addEventListener("DOMContentLoaded", () => {

    const token = localStorage.getItem("campusfix_token");
    const role = localStorage.getItem("campusfix_role");
    
    if (!token || role !== "admin") {
        alert("Akses ditolak! Anda bukan admin.");
        window.location.href = "login.html";
        return;
    }

    ambilSemuaLaporan();

    document.getElementById("filterStatus").addEventListener("change", filterTabelLaporan);

    const selectTindakan = document.getElementById("selectTindakan");
    const wadahAlasanTolak = document.getElementById("wadahAlasanTolak");
    const inputAlasanTolak = document.getElementById("inputAlasanTolak");

    selectTindakan.addEventListener("change", function() {
        if (this.value === "rejected") {
            wadahAlasanTolak.classList.remove("d-none");
            inputAlasanTolak.setAttribute("required", "true");
        } else {
            wadahAlasanTolak.classList.add("d-none");
            inputAlasanTolak.removeAttribute("required");
            inputAlasanTolak.value = "";
        }
    });

    document.getElementById("formProsesLaporan").addEventListener("submit", prosesPembaruanStatus);

    document.getElementById("btnLogout").addEventListener("click", () => {
        localStorage.removeItem("campusfix_token");
        localStorage.removeItem("campusfix_role");
        window.location.href = "login.html";
    });
});

// --- AMBIL DATA ---
async function ambilSemuaLaporan() {
    const tbodyLaporan = document.getElementById("tbodyLaporan");
    const dataKosongRow = document.getElementById("dataKosongRow");
    
    // Mengganti isi tabel dengan animasi loading setiap kali fungsi dipanggil
    tbodyLaporan.innerHTML = `
        <tr id="loadingRow">
            <td colspan="5" class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                <br>Memuat data laporan...
            </td>
        </tr>
    `;
    dataKosongRow.classList.add("d-none");

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/reports`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("campusfix_token")}`
            }
        });

        if (!response.ok) throw new Error("Gagal mengambil data laporan");

        semuaDataLaporan = await response.json();

        renderTabel(semuaDataLaporan);

    } catch (error) {
        console.error("Error Fetching Admin Reports:", error);
        tbodyLaporan.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Terjadi kesalahan saat memuat data.</td></tr>`;
    }
}

// --- FUNGSI RENDER TABEL & FILTER ---
function renderTabel(dataArray) {
    const tbodyLaporan = document.getElementById("tbodyLaporan");
    const dataKosongRow = document.getElementById("dataKosongRow");
    
    tbodyLaporan.innerHTML = "";

    if (dataArray.length === 0) {
        dataKosongRow.classList.remove("d-none");
        return;
    }

    dataKosongRow.classList.add("d-none");

    dataArray.forEach(report => {
        // Konversi status API menjadi UI Badge
        let badgeClass = "bg-secondary";
        let statusText = "Baru";
        const statusLower = report.status ? report.status.toLowerCase() : "baru";
        
        if (statusLower === "baru") { badgeClass = "bg-info text-dark"; statusText = "Baru"; }
        else if (statusLower === "accepted") { badgeClass = "bg-primary"; statusText = "Diproses"; }
        else if (statusLower === "completed") { badgeClass = "bg-success"; statusText = "Selesai"; }
        else if (statusLower === "rejected") { badgeClass = "bg-danger"; statusText = "Ditolak"; }

        const tanggal = new Date(report.created_at || new Date()).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric"
        });

        // Simpan data mentah ke dalam button agar mudah diambil saat modal dibuka
        const reportDataJson = encodeURIComponent(JSON.stringify(report));

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="px-4 text-muted small">${tanggal}</td>
            <td class="fw-medium text-dark">${report.category}</td>
            <td class="small text-secondary text-truncate" style="max-width: 200px;">${report.location}</td>
            <td><span class="badge status-badge ${badgeClass}">${statusText}</span></td>
            <td class="px-4 text-end">
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="bukaModalProses('${reportDataJson}')">
                    Proses
                </button>
            </td>
        `;
        tbodyLaporan.appendChild(tr);
    });
}

function filterTabelLaporan(e) {
    const keywordStatus = e.target.value; 
    
    if (keywordStatus === "semua") {
        renderTabel(semuaDataLaporan);
    } else {
        const filteredData = semuaDataLaporan.filter(report => {
            const reportStatus = report.status ? report.status.toLowerCase() : "baru";
            return reportStatus === keywordStatus;
        });
        renderTabel(filteredData);
    }
}

// --- FUNGSI MODAL ---
function bukaModalProses(reportDataEncoded) {
    const report = JSON.parse(decodeURIComponent(reportDataEncoded));
    
    // Isi data ke dalam modal
    document.getElementById("modalReportId").value = report.id;
    document.getElementById("modalKategori").textContent = report.category;
    document.getElementById("modalLokasi").textContent = report.location;
    document.getElementById("modalDeskripsi").textContent = report.description;
    
    // Foto
    const fotoElement = document.getElementById("modalFotoLaporan");
    fotoElement.src = report.photo_url ? report.photo_url : "https://placehold.co/400x300?text=Tidak+Ada+Foto";

    // Reset Form Modal
    document.getElementById("formProsesLaporan").reset();
    document.getElementById("wadahAlasanTolak").classList.add("d-none");
    document.getElementById("alertProses").classList.add("d-none");

    // Tampilkan Modal
    const modalInstance = new bootstrap.Modal(document.getElementById('modalProsesLaporan'));
    modalInstance.show();
}

async function prosesPembaruanStatus(e) {
    e.preventDefault();
    
    const reportId = document.getElementById("modalReportId").value;
    const newStatus = document.getElementById("selectTindakan").value;
    const adminNote = document.getElementById("inputAlasanTolak").value;
    const btnSimpan = document.getElementById("btnSimpanStatus");
    const alertProses = document.getElementById("alertProses");

    btnSimpan.disabled = true;
    btnSimpan.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Menyimpan...`;
    alertProses.classList.add("d-none");

    try {
        const payload = {
            status: newStatus
        };
        
        if (newStatus === "rejected") {
            payload.admin_note = adminNote;
        }

        const response = await fetch(`${API_BASE_URL}/api/admin/reports/${reportId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("campusfix_token")}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const modalEl = document.getElementById('modalProsesLaporan');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();

            ambilSemuaLaporan();
        } else {
            const errData = await response.json();
            throw new Error(errData.message || "Gagal memperbarui status");
        }

    } catch (error) {
        console.error("Update Status Error:", error);
        alertProses.className = "alert alert-danger py-2 small mb-3";
        alertProses.textContent = error.message;
        alertProses.classList.remove("d-none");
    } finally {
        btnSimpan.disabled = false;
        btnSimpan.textContent = "Simpan Perubahan";
    }
}