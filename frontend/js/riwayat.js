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

// Palet Warna Status sesuai Panduan Design System SuperApp
function getStatusMeta(rawStatus) {
    const statusLower = rawStatus ? rawStatus.toLowerCase() : "pending";

    if (statusLower === "pending" || statusLower === "baru") {
        return {
            key: "pending",
            group: "proses",
            badgeStyle: "background-color: #5E6E63; color: #FFFFFF;",
            iconClass: "bi-circle-fill",
            label: "Baru"
        };
    }
    if (statusLower === "accepted" || statusLower === "diverifikasi" || statusLower === "diproses") {
        return {
            key: "accepted",
            group: "proses",
            badgeStyle: "background-color: #1C5DA8; color: #FFFFFF;",
            iconClass: "bi-arrow-repeat",
            label: "Diproses"
        };
    }
    if (statusLower === "completed" || statusLower === "selesai") {
        return {
            key: "completed",
            group: "selesai",
            badgeStyle: "background-color: #1B7A43; color: #FFFFFF;",
            iconClass: "bi-check-circle-fill",
            label: "Selesai"
        };
    }
    if (statusLower === "rejected" || statusLower === "ditolak") {
        return {
            key: "rejected",
            group: "ditolak",
            badgeStyle: "background-color: #B3261E; color: #FFFFFF;",
            iconClass: "bi-x-circle-fill",
            label: "Ditolak"
        };
    }

    return {
        key: statusLower,
        group: "proses",
        badgeStyle: "background-color: #5E6E63; color: #FFFFFF;",
        iconClass: "bi-circle-fill",
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
            <div class="alert py-4 text-center" style="background-color: #FDECEA; color: #B3261E; border-radius: 16px; border: 1px solid #F5C2BE; font-size: 14px;">
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
            <span style="font-size: 12px; color: #1C5DA8; font-weight: 600;">
                <i class="bi bi-arrow-repeat me-1"></i> Diterima & Diproses: ${waktuUpdate}
            </span>`;
    } else if (meta.key === "completed") {
        infoWaktuStatusHtml = `
            <span style="font-size: 12px; color: #1B7A43; font-weight: 600;">
                <i class="bi bi-check-circle-fill me-1"></i> Selesai: ${waktuUpdate}
            </span>`;
    } else if (meta.key === "rejected") {
        infoWaktuStatusHtml = `
            <span style="font-size: 12px; color: #B3261E; font-weight: 600;">
                <i class="bi bi-x-circle-fill me-1"></i> Ditolak: ${waktuUpdate}
            </span>`;
    }

    return `
        <div class="card card-custom mb-4 overflow-hidden">
            <div class="row g-0">
                <div class="col-md-3 img-laporan-wrapper">
                    <img src="${fotoUrl}" onclick="bukaPreviewFoto(this.src)" title="Klik untuk memperbesar foto" onerror="this.onerror=null;this.src='https://placehold.co/300x200?text=Gagal+Memuat+Foto';" class="img-laporan" alt="Foto Fasilitas">
                </div>
                <div class="col-md-9 d-flex flex-column justify-content-center">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <h3 class="card-title fw-bold mb-0" style="font-size: 18px; color: #14261B;">${kategori}</h3>
                            <span class="status-badge" style="${meta.badgeStyle}">
                                <i class="bi ${meta.iconClass}"></i> ${meta.label}
                            </span>
                        </div>
                        <p class="fw-semibold mb-2" style="font-size: 13px; color: #155E38;">
                            <i class="bi bi-geo-alt-fill me-1"></i> ${report.location || "-"}
                        </p>
                        <p class="card-text mb-3" style="font-size: 14px; color: #44574B;">
                            ${report.description || "-"}
                        </p>
                        <div class="d-flex flex-column gap-1 mt-auto pt-3" style="border-top: 1px solid #D5E2DA;">
                            <span style="font-size: 12px; color: #44574B;">
                                <i class="bi bi-clock-history me-1"></i> Dilaporkan: ${waktuDilaporkan}
                            </span>
                            ${infoWaktuStatusHtml}
                            ${report.admin_note ? `
                            <span class="mt-1" style="font-size: 12px; color: #B3261E; font-weight: 600;" title="Alasan Penolakan/Catatan Admin">
                                <i class="bi bi-exclamation-circle-fill me-1"></i> Alasan Penolakan: ${report.admin_note}
                            </span>` : ""}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}