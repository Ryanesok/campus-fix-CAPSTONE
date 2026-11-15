const LOGIN_PAGE_URL = "login.html";

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

function formatWaktuAdmin(isoString) {
    if (!isoString) return { singkat: "-", jam: "", lengkap: "-" };
    const dateObj = new Date(isoString);
    if (Number.isNaN(dateObj.getTime())) return { singkat: "-", jam: "", lengkap: "-" };

    const tanggalLengkap = dateObj.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    const tanggalSingkat = dateObj.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
    const jam = dateObj.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).replace(/\./g, ":");

    return {
        singkat: tanggalSingkat,
        jam: `${jam} WIB`,
        lengkap: `${tanggalLengkap}, ${jam} WIB`
    };
}

// Status & badge UI
function getStatusMeta(rawStatus) {
    const statusLower = rawStatus ? rawStatus.toLowerCase() : "pending";
    if (statusLower === "pending" || statusLower === "baru") {
        return { key: "pending", badgeClass: "bg-info text-dark", text: "Baru", isFinal: false };
    }
    if (statusLower === "accepted") {
        return { key: "accepted", badgeClass: "bg-primary", text: "Diproses", isFinal: false };
    }
    if (statusLower === "completed") {
        return { key: "completed", badgeClass: "bg-success", text: "Selesai", isFinal: true };
    }
    if (statusLower === "rejected") {
        return { key: "rejected", badgeClass: "bg-danger", text: "Ditolak", isFinal: true };
    }
    return { key: statusLower, badgeClass: "bg-secondary", text: rawStatus || "Baru", isFinal: false };
}

// Resolusi URL foto
function resolvePhotoUrl(report) {
    const rawUrl = report.photo_url || report.image_url || report.photo || report.foto_url || "";
    if (!rawUrl) {
        return "https://placehold.co/400x300?text=Tidak+Ada+Foto";
    }
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")) {
        return rawUrl;
    }
    return `${API_BASE_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

// --- AMBIL DATA ---
async function ambilSemuaLaporan() {
    const tbodyLaporan = document.getElementById("tbodyLaporan");
    const dataKosongRow = document.getElementById("dataKosongRow");
    
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

        if (response.status === 401) {
            localStorage.removeItem("campusfix_token");
            localStorage.removeItem("campusfix_role");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) throw new Error("Gagal mengambil data laporan");

        const result = await response.json();
        semuaDataLaporan = Array.isArray(result) ? result : (result.data || result.reports || []);

        const activeFilter = document.getElementById("filterStatus").value;
        if (activeFilter === "semua") {
            renderTabel(semuaDataLaporan);
        } else {
            const filtered = semuaDataLaporan.filter(r => getStatusMeta(r.status).key === activeFilter);
            renderTabel(filtered);
        }

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
        const statusMeta = getStatusMeta(report.status);
        const waktu = formatWaktuAdmin(report.created_at);

        const reportDataJson = encodeURIComponent(JSON.stringify(report));
        const btnClass = statusMeta.isFinal ? "btn-outline-secondary" : "btn-outline-primary";
        const btnLabel = statusMeta.isFinal ? "Detail" : "Proses";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="px-4 small">
                <div class="fw-medium text-dark">${waktu.singkat}</div>
                <div class="text-muted" style="font-size: 0.78rem;">${waktu.jam}</div>
            </td>
            <td class="fw-medium text-dark">${report.category || "-"}</td>
            <td class="small text-secondary text-truncate" style="max-width: 200px;">${report.location || "-"}</td>
            <td><span class="badge status-badge ${statusMeta.badgeClass}">${statusMeta.text}</span></td>
            <td class="px-4 text-end">
                <button class="btn btn-sm ${btnClass} rounded-pill px-3" onclick="bukaModalProses('${reportDataJson}')">
                    ${btnLabel}
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
            return getStatusMeta(report.status).key === keywordStatus;
        });
        renderTabel(filteredData);
    }
}

// --- FUNGSI MODAL ---
function bukaModalProses(reportDataEncoded) {
    const report = JSON.parse(decodeURIComponent(reportDataEncoded));
    const statusMeta = getStatusMeta(report.status);
    const waktuLapor = formatWaktuAdmin(report.created_at);
    const waktuUpdate = formatWaktuAdmin(report.updated_at);
    
    // Isi data ke dalam modal
    document.getElementById("modalReportId").value = report.id;
    document.getElementById("modalWaktuLapor").textContent = waktuLapor.lengkap;
    document.getElementById("modalKategori").textContent = report.category || "-";
    document.getElementById("modalLokasi").textContent = report.location || "-";
    document.getElementById("modalDeskripsi").textContent = report.description || "-";

    // Atur tampilan Waktu Diterima/Diproses, Waktu Selesai, atau Waktu Ditolak
    const wadahWaktuStatus = document.getElementById("modalWadahWaktuStatus");
    const labelWaktuStatus = document.getElementById("modalLabelWaktuStatus");
    const teksWaktuStatus = document.getElementById("modalWaktuStatus");

    if (statusMeta.key === "accepted") {
        wadahWaktuStatus.classList.remove("d-none");
        labelWaktuStatus.textContent = "Waktu Diterima & Diproses";
        teksWaktuStatus.textContent = waktuUpdate.lengkap;
    } else if (statusMeta.key === "completed") {
        wadahWaktuStatus.classList.remove("d-none");
        labelWaktuStatus.textContent = "Waktu Selesai";
        teksWaktuStatus.textContent = waktuUpdate.lengkap;
    } else if (statusMeta.key === "rejected") {
        wadahWaktuStatus.classList.remove("d-none");
        labelWaktuStatus.textContent = "Waktu Ditolak";
        teksWaktuStatus.textContent = waktuUpdate.lengkap;
    } else {
        wadahWaktuStatus.classList.add("d-none");
        teksWaktuStatus.textContent = "-";
    }

    const badgeEl = document.getElementById("modalStatusBadge");
    badgeEl.className = `badge status-badge ${statusMeta.badgeClass}`;
    badgeEl.textContent = statusMeta.text;

    // Tampilkan alasan penolakan jika status Ditolak
    const modalWadahAlasan = document.getElementById("modalWadahAlasanTolak");
    const modalAlasanTolak = document.getElementById("modalAlasanTolak");
    if (statusMeta.key === "rejected") {
        modalAlasanTolak.textContent = report.admin_note || "Tidak ada keterangan penolakan.";
        modalWadahAlasan.classList.remove("d-none");
    } else {
        modalWadahAlasan.classList.add("d-none");
        modalAlasanTolak.textContent = "-";
    }
    
    // Foto
    const fotoElement = document.getElementById("modalFotoLaporan");
    fotoElement.onerror = function() {
        this.onerror = null;
        this.src = "https://placehold.co/400x300?text=Gagal+Memuat+Foto";
    };
    fotoElement.src = resolvePhotoUrl(report);

    // Reset Form Modal
    const formEl = document.getElementById("formProsesLaporan");
    const selectTindakan = document.getElementById("selectTindakan");
    const infoAlurStatus = document.getElementById("infoAlurStatus");
    const kolomDetail = document.getElementById("kolomDetailLaporan");
    const kolomAksi = document.getElementById("kolomAksiAdmin");

    formEl.reset();
    document.getElementById("wadahAlasanTolak").classList.add("d-none");
    document.getElementById("inputAlasanTolak").removeAttribute("required");
    document.getElementById("alertProses").classList.add("d-none");

    // Sembunyikan kolom tindakan jika status sudah final (Selesai / Ditolak)
    if (statusMeta.isFinal) {
        kolomAksi.classList.add("d-none");
        kolomDetail.className = "col-12";
    } else {
        kolomAksi.classList.remove("d-none");
        kolomDetail.className = "col-md-6 mb-3 mb-md-0";

        const optAccepted = selectTindakan.querySelector('option[value="accepted"]');
        const optCompleted = selectTindakan.querySelector('option[value="completed"]');
        const optRejected = selectTindakan.querySelector('option[value="rejected"]');

        if (statusMeta.key === "pending") {
            optAccepted.disabled = false;
            optCompleted.disabled = true;
            optRejected.disabled = false;
            infoAlurStatus.textContent = "Laporan baru dapat diterima untuk diproses atau ditolak.";
        } else if (statusMeta.key === "accepted") {
            optAccepted.disabled = true;
            optCompleted.disabled = false;
            optRejected.disabled = true;
            infoAlurStatus.textContent = "Laporan sedang diproses. Tindakan selanjutnya adalah menandai Selesai.";
        }
    }

    // Tampilkan Modal
    const modalInstance = new bootstrap.Modal(document.getElementById('modalProsesLaporan'));
    modalInstance.show();
}

async function prosesPembaruanStatus(e) {
    e.preventDefault();
    
    const reportId = document.getElementById("modalReportId").value;
    const newStatus = document.getElementById("selectTindakan").value;
    const adminNote = document.getElementById("inputAlasanTolak").value.trim();
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
            if (document.activeElement) {
                document.activeElement.blur();
            }
            const modalEl = document.getElementById('modalProsesLaporan');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            modalInstance.hide();

            ambilSemuaLaporan();
        } else {
            const errData = await response.json().catch(() => ({}));
            const errorDetail = Array.isArray(errData.detail)
                ? errData.detail.map(item => item.msg).join(", ")
                : (errData.detail || errData.message || `Gagal memperbarui status (${response.status})`);
            throw new Error(errorDetail);
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