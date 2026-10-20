const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    ambilRiwayatLaporan();
});

async function ambilRiwayatLaporan() {
    const listLaporan = document.getElementById("listLaporan");
    const loadingData = document.getElementById("loadingData");
    const dataKosong = document.getElementById("dataKosong");
    const token = localStorage.getItem("campusfix_token");

    try {
        if (!token) {
            throw new Error("Token login tidak ditemukan. Silakan login kembali.");
        }

        const response = await fetch(`${API_BASE_URL}/api/reports/me`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

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

        reports.forEach(report => {
            listLaporan.innerHTML += buatCardLaporan(report);
        });
    } catch (error) {
        console.error("Error Fetching Reports:", error);
        loadingData.innerHTML = `
            <div class="alert alert-danger rounded-4 py-4 text-center">
                <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
                ${error.message}
            </div>`;
    }
}

function buatCardLaporan(report) {
    let badgeClass = "bg-secondary";
    let iconClass = "bi-circle";
    const statusLower = report.status ? report.status.toLowerCase() : "baru";

    if (statusLower === "baru") {
        badgeClass = "bg-info text-dark";
        iconClass = "bi-asterisk";
    } else if (statusLower === "diverifikasi") {
        badgeClass = "bg-primary";
        iconClass = "bi-check-circle";
    } else if (statusLower === "diproses") {
        badgeClass = "bg-warning text-dark";
        iconClass = "bi-gear-fill spin";
    } else if (statusLower === "selesai") {
        badgeClass = "bg-success";
        iconClass = "bi-check2-all";
    } else if (statusLower === "ditolak") {
        badgeClass = "bg-danger";
        iconClass = "bi-x-circle";
    }

    const tanggal = new Date(report.created_at || new Date()).toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric"
    });
    const fotoUrl = report.photo_url
        ? report.photo_url
        : "https://placehold.co/300x200?text=Tidak+Ada+Foto";

    return `
        <div class="card card-custom mb-4 overflow-hidden">
            <div class="row g-0">
                <div class="col-md-3">
                    <img src="${fotoUrl}" class="img-fluid w-100 img-laporan" alt="Foto Fasilitas">
                </div>
                <div class="col-md-9 d-flex flex-column justify-content-center">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title fw-bold mb-0 text-dark">${report.category}</h5>
                            <span class="badge status-badge ${badgeClass}">
                                <i class="bi ${iconClass} me-1"></i> ${report.status}
                            </span>
                        </div>
                        <p class="text-primary small fw-medium mb-2">
                            <i class="bi bi-geo-alt-fill me-1"></i> ${report.location}
                        </p>
                        <p class="card-text mb-3 text-secondary" style="font-size: 0.95rem;">
                            ${report.description}
                        </p>
                        <div class="d-flex justify-content-between align-items-center mt-auto pt-3 border-top">
                            <small class="text-muted">
                                <i class="bi bi-calendar3 me-1"></i> Dilaporkan: ${tanggal}
                            </small>
                            ${report.admin_note ? `
                            <small class="text-danger fw-medium" title="Alasan Penolakan/Catatan Admin">
                                <i class="bi bi-exclamation-circle-fill me-1"></i> ${report.admin_note}
                            </small>` : ""}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
