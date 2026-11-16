const API_BASE_URL = "http://127.0.0.1:8000";
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

if (cekSesiKedaluwarsa()) {
    paksaLogoutSesiHabis();
}
setInterval(() => {
    if (cekSesiKedaluwarsa()) paksaLogoutSesiHabis();
}, 15000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && cekSesiKedaluwarsa()) paksaLogoutSesiHabis();
});

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("campusfix_token");
    const role = localStorage.getItem("campusfix_role");

    if (!token) {
        window.location.href = LOGIN_PAGE_URL;
        return;
    }

    if (role === "admin") {
        window.location.href = "admin.html";
        return;
    }

    ambilRiwayatLaporan();
});

function bukaPreviewFoto(src) {
    const modalEl = document.getElementById("modalPreviewFoto");
    const imgEl = document.getElementById("imgPreviewPenuh");
    if (!modalEl || !imgEl || !src) return;

    imgEl.src = src;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

function formatWaktuLengkap(isoString) {
    if (!isoString) return "-";
    const dateObj = new Date(isoString);
    if (Number.isNaN(dateObj.getTime())) return "-";

    const tanggal = dateObj.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    const waktu = dateObj.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).replace(/\./g, ":");

    return `${tanggal}, ${waktu} WIB`;
}

function getStatusMeta(rawStatus) {
    const statusLower = rawStatus ? rawStatus.toLowerCase() : "pending";

    if (statusLower === "pending" || statusLower === "baru") {
        return {
            key: "pending",
            group: "proses",
            badgeClass: "bg-info text-dark",
            iconClass: "bi-clock",
            label: "Baru"
        };
    }
    if (statusLower === "accepted" || statusLower === "diverifikasi" || statusLower === "diproses") {
        return {
            key: "accepted",
            group: "proses",
            badgeClass: "bg-warning text-dark",
            iconClass: "bi-gear-fill",
            label: "Diproses"
        };
    }
    if (statusLower === "completed" || statusLower === "selesai") {
        return {
            key: "completed",
            group: "selesai",
            badgeClass: "bg-success",
            iconClass: "bi-check2-all",
            label: "Selesai"
        };
    }
    if (statusLower === "rejected" || statusLower === "ditolak") {
        return {
            key: "rejected",
            group: "ditolak",
            badgeClass: "bg-danger",
            iconClass: "bi-x-circle",
            label: "Ditolak"
        };
    }

    return {
        key: statusLower,
        group: "proses",
        badgeClass: "bg-secondary",
        iconClass: "bi-circle",
        label: rawStatus || "Baru"
    };
}

function resolvePhotoUrl(report) {
    const rawUrl = report.photo_url || report.image_url || report.photo || "";
    if (!rawUrl) {
        return "https://placehold.co/300x200?text=Tidak+Ada+Foto";
    }
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")) {
        return rawUrl;
    }
    return `${API_BASE_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

async function ambilRiwayatLaporan() {
    const listLaporan = document.getElementById("listLaporan");
    const loadingData = document.getElementById("loadingData");
    const dataKosong = document.getElementById("dataKosong");
    const dashboardContent = document.getElementById("dashboardContent");
    const token = localStorage.getItem("campusfix_token");

    const statTotal = document.getElementById("statTotal");
    const statProses = document.getElementById("statProses");
    const statSelesai = document.getElementById("statSelesai");
    const statDitolak = document.getElementById("statDitolak");

    try {
        const response = await fetch(`${API_BASE_URL}/api/reports/me`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            paksaLogoutSesiHabis();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.detail || errorData.message || `Request gagal (${response.status})`
            );
        }

        const reports = await response.json();
        loadingData.classList.add("d-none");

        if (!reports || reports.length === 0) {
            dataKosong.classList.remove("d-none");
            return;
        }

        if (dashboardContent) dashboardContent.classList.remove("d-none");

        let countTotal = reports.length;
        let countProses = 0;
        let countSelesai = 0;
        let countDitolak = 0;
        const cardsHtml = [];

        reports.forEach(report => {
            const meta = getStatusMeta(report.status);

            if (meta.group === "proses") {
                countProses++;
            } else if (meta.group === "selesai") {
                countSelesai++;
            } else if (meta.group === "ditolak") {
                countDitolak++;
            }

            cardsHtml.push(buatCardLaporan(report, meta));
        });

        listLaporan.innerHTML = cardsHtml.join("");

        if (statTotal) statTotal.textContent = countTotal;
        if (statProses) statProses.textContent = countProses;
        if (statSelesai) statSelesai.textContent = countSelesai;
        if (statDitolak) statDitolak.textContent = countDitolak;

    } catch (error) {
        console.error("Error Fetching Reports:", error);
        loadingData.innerHTML = `
            <div class="alert alert-danger rounded-4 py-4 text-center">
                <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
                ${error.message}
            </div>`;
    }
}

function buatCardLaporan(report, meta) {
    const waktuDilaporkan = formatWaktuLengkap(report.created_at);
    const waktuUpdate = formatWaktuLengkap(report.updated_at);
    const fotoUrl = resolvePhotoUrl(report);
    const kategori = report.category || report.final_category || "-";

    let infoWaktuStatusHtml = "";
    if (meta.key === "accepted") {
        infoWaktuStatusHtml = `
            <small class="text-primary fw-medium">
                <i class="bi bi-gear me-1"></i> Diterima & Diproses: ${waktuUpdate}
            </small>`;
    } else if (meta.key === "completed") {
        infoWaktuStatusHtml = `
            <small class="text-success fw-medium">
                <i class="bi bi-check-circle me-1"></i> Selesai: ${waktuUpdate}
            </small>`;
    } else if (meta.key === "rejected") {
        infoWaktuStatusHtml = `
            <small class="text-danger fw-medium">
                <i class="bi bi-x-circle me-1"></i> Ditolak: ${waktuUpdate}
            </small>`;
    }

    return `
        <div class="card card-custom mb-4 overflow-hidden border">
            <div class="row g-0">
                <div class="col-md-3 img-laporan-wrapper">
                    <img src="${fotoUrl}" onclick="bukaPreviewFoto(this.src)" title="Klik untuk memperbesar foto" onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=Gagal+Memuat+Foto';" class="img-laporan" alt="Foto Fasilitas">
                </div>
                <div class="col-md-9 d-flex flex-column justify-content-center">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title fw-bold mb-0 text-dark">${kategori}</h5>
                            <span class="badge status-badge ${meta.badgeClass}">
                                <i class="bi ${meta.iconClass} me-1"></i> ${meta.label}
                            </span>
                        </div>
                        <p class="text-primary small fw-medium mb-2">
                            <i class="bi bi-geo-alt-fill me-1"></i> ${report.location || "-"}
                        </p>
                        <p class="card-text mb-3 text-secondary" style="font-size: 0.95rem;">
                            ${report.description || "-"}
                        </p>
                        <div class="d-flex flex-column gap-1 mt-auto pt-3 border-top">
                            <small class="text-muted">
                                <i class="bi bi-clock-history me-1"></i> Dilaporkan: ${waktuDilaporkan}
                            </small>
                            ${infoWaktuStatusHtml}
                            ${report.admin_note ? `
                            <small class="text-danger fw-medium mt-1" title="Alasan Penolakan/Catatan Admin">
                                <i class="bi bi-exclamation-circle-fill me-1"></i> Alasan Penolakan: ${report.admin_note}
                            </small>` : ""}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}