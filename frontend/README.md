# Frontend
Dikerjakan oleh anggota tim frontend (HTML, CSS, Bootstrap, JavaScript). Berkomunikasi dengan backend hanya lewat REST API (lihat `docs/API.md`). Jangan menyimpan `service_role` key di sini.

## Environment

Frontend hanya membutuhkan konfigurasi publik:

```text
BACKEND_API_URL=http://127.0.0.1:8000
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

Jika frontend memakai Vite, gunakan prefix `VITE_` untuk ketiga variabel.
Jika memakai Next.js, gunakan prefix `NEXT_PUBLIC_`. Jangan memasukkan
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, atau password database ke frontend.

Lihat [`docs/FRONTEND_AI_HANDOFF.md`](../docs/FRONTEND_AI_HANDOFF.md) untuk
kontrak endpoint, autentikasi, upload foto, dan integrasi AI.

# Command Untuk Login Via Inspect - Console (Pelapor)
localStorage.setItem('campusfix_token', 'dummy-token'); localStorage.setItem('campusfix_role', 'pelapor'); window.location.href = '../index.html';

# Command Untuk Login Via Inspect - Console (Admin)
localStorage.setItem('campusfix_token', 'dummy-token'); localStorage.setItem('campusfix_role', 'admin'); window.location.href = 'admin.html';

# Data Dummy Pelapor Via Console

const originalFetch = window.fetch;

window.fetch = async function() {
    if (arguments[0].includes("/api/reports/me")) {
        console.log("🛠️ Memalsukan respon API untuk ngetes UI Dashboard...");
        return {
            ok: true,
            json: async () => [
                {
                    id: 1,
                    category: "AC",
                    location: "Gedung Kuliah Terpadu, Lantai 2, Ruang 204",
                    description: "AC meneteskan air cukup deras dan tidak dingin sama sekali. Mengganggu perkuliahan.",
                    status: "baru",
                    photo_url: "https://placehold.co/400x300/e3f2fd/1e88e5?text=AC+Bocor",
                    created_at: "2026-10-18T08:00:00Z",
                    admin_note: null
                },
                {
                    id: 2,
                    category: "Proyektor",
                    location: "Gedung Fakultas Sains, Lantai 1, Ruang 101",
                    description: "Warna proyektor dominan kuning dan layarnya bergaris-garis.",
                    status: "diproses",
                    photo_url: "https://placehold.co/400x300/fff3e0/f57c00?text=Proyektor+Rusak",
                    created_at: "2026-10-15T10:30:00Z",
                    admin_note: null
                },
                {
                    id: 3,
                    category: "Kursi",
                    location: "Perpustakaan Pusat, Lantai 3",
                    description: "Patahan pada sandaran kursi, sangat berbahaya jika diduduki mahasiswa.",
                    status: "ditolak",
                    photo_url: "https://placehold.co/400x300/ffebee/e53935?text=Kursi+Patah",
                    created_at: "2026-10-10T14:15:00Z",
                    admin_note: "Laporan ganda. Fasilitas ini sudah dilaporkan oleh mahasiswa lain kemarin dan sedang dalam antrean perbaikan."
                },
                {
                    id: 4,
                    category: "Lampu",
                    location: "Gedung A, Lorong Lantai 1",
                    description: "Lampu mati total membuat lorong gelap gulita, terutama saat malam hari.",
                    status: "selesai",
                    photo_url: "https://placehold.co/400x300/e8f5e9/43a047?text=Lampu+Mati",
                    created_at: "2026-10-01T09:00:00Z",
                    admin_note: null
                }
            ]
        };
    }
    return originalFetch.apply(this, arguments);
};

document.getElementById("listLaporan").innerHTML = "";
ambilRiwayatLaporan();

# Data Dummy Admin Via Console

window.dummyAdminDb = [
    {
        id: 101,
        category: "AC",
        location: "Gedung Kuliah Terpadu, Lantai 2, Ruang 204",
        description: "AC meneteskan air cukup deras dan tidak dingin sama sekali. Mengganggu perkuliahan.",
        status: "baru",
        photo_url: "https://placehold.co/400x300/e3f2fd/1e88e5?text=AC+Bocor",
        created_at: "2026-10-20T08:00:00Z",
        admin_note: null
    },
    {
        id: 102,
        category: "Proyektor",
        location: "Gedung Fakultas Sains, Lantai 1, Ruang 101",
        description: "Warna proyektor dominan kuning dan layarnya bergaris-garis.",
        status: "accepted", // Artinya sedang diproses
        photo_url: "https://placehold.co/400x300/fff3e0/f57c00?text=Proyektor+Rusak",
        created_at: "2026-10-19T10:30:00Z",
        admin_note: null
    },
    {
        id: 103,
        category: "Lampu",
        location: "Gedung A, Lorong Lantai 1",
        description: "Lampu mati total membuat lorong gelap gulita.",
        status: "completed", // Artinya selesai
        photo_url: "https://placehold.co/400x300/e8f5e9/43a047?text=Lampu+Mati",
        created_at: "2026-10-18T09:00:00Z",
        admin_note: null
    },
    {
        id: 104,
        category: "Kursi",
        location: "Perpustakaan Pusat, Lantai 3",
        description: "Patahan pada sandaran kursi.",
        status: "rejected", // Artinya ditolak
        photo_url: "https://placehold.co/400x300/ffebee/e53935?text=Kursi+Patah",
        created_at: "2026-10-17T14:15:00Z",
        admin_note: "Fasilitas ini sudah masuk jadwal perbaikan rutin minggu depan."
    }
];

const originalFetchAdmin = window.fetch;

window.fetch = async function() {
    const url = arguments[0];
    const options = arguments[1] || {};

    if (url.includes("/api/admin/reports") && (!options.method || options.method === "GET")) {
        console.log("🛠️ Mengambil data...");
        return {
            ok: true,
            json: async () => window.dummyAdminDb
        };
    }

    if (url.includes("/api/admin/reports/") && url.includes("/status") && options.method === "PATCH") {
        console.log("🛠️ Memperbarui status laporan di database sementara...");

        const parts = url.split("/");
        const reportId = parseInt(parts[parts.length - 2]);

        const payload = JSON.parse(options.body);
        
        const reportIndex = window.dummyAdminDb.findIndex(r => r.id === reportId);
        if (reportIndex !== -1) {
            window.dummyAdminDb[reportIndex].status = payload.status;
            
            if (payload.status === "rejected") {
                window.dummyAdminDb[reportIndex].admin_note = payload.admin_note;
            } else {
                window.dummyAdminDb[reportIndex].admin_note = null; 
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
            ok: true,
            json: async () => ({ message: "Status berhasil diupdate" })
        };
    }

    return originalFetchAdmin.apply(this, arguments);
};

ambilSemuaLaporan();