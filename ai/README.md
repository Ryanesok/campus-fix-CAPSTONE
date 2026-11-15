# CampusFix AI Module

Direktori ini memisahkan modul dan artefak model AI dari frontend dan backend agar arsitektur proyek lebih bersih dan modular.

## Struktur Direktori

```text
ai/
├── model/
│   └── tfjs_graph_model/            # Bobot dan arsitektur model (model.json & .bin shards)
│       ├── model.json
│       ├── group1-shard1of3.bin
│       ├── group1-shard2of3.bin
│       ├── group1-shard3of3.bin
│       └── conversion_metadata.json
├── ai_module/                       # Modul logika JavaScript / preprocessing & threshold policy
│   ├── inference/
│   ├── model/
│   ├── preprocessing/
│   └── index.js
├── predictor.py                     # Antarmuka Python predictor untuk dipanggil backend
└── README.md                        # Dokumentasi modul AI
```

## Kelas Fasilitas yang Didukung

1. `AC`
2. `KURSI`
3. `LAMPU`
4. `PROYEKTOR`

## Alur Integrasi

1. **Frontend** mengirimkan file gambar via HTTP multipart form ke backend API: `POST /api/predictions`.
2. **Backend** memanggil antarmuka modul AI di `ai/predictor.py`.
3. **Backend** mengembalikan respon JSON berisikan hasil prediksi `category` dan `confidence`.
4. **Frontend** menampilkan rekomendasi AI dan mengatur kategori form secara otomatis jika tingkat keyakinan memenuhi ambang batas (>= 60%).
