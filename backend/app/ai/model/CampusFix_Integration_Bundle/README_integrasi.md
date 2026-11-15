# CampusFix — Paket Integrasi Model Klasifikasi

## Jenis model
- Arsitektur: MobileNetV2 transfer learning, dipilih berdasarkan validation dari notebook 03.
- Output: kategori fasilitas AC, Kursi, Lampu, Proyektor (bukan deteksi kerusakan).
- Kelas dan indeks: 0=AC, 1=Kursi, 2=Lampu, 3=Proyektor.
- Jumlah sampel test dievaluasi: 75.
- Accuracy test: 1.0000.
- Macro F1 test: 1.0000.

## File paket
- `campusfix_mobilenetv2.keras` — model Keras final, identik dengan model training.
- `saved_model/` — SavedModel untuk converter atau TensorFlow Serving.
- `class_names.json`, `preprocessing_spec.json`, `model_contract.json`.
- `browser_inference_example.js` — contoh kode untuk frontend **setelah** berhasil konversi TF.js.
- `model_sha256.txt`, `saved_model_equivalence.json`.
- `tfjs_graph_model/` — **hanya muncul jika konversi opsional berhasil**.

## Alur input yang WAJIB sama
1. Terapkan orientasi EXIF, konversi gambar ke RGB.
2. Pertahankan rasio aspek; resize & letterbox ke 224x224, padding RGB(128,128,128).
3. Bentuk tensor float32 [1,224,224,3] dengan nilai 0..255.
4. **JANGAN normalisasi di luar model**. Di dalam model sudah ada Rescaling(1/127.5, offset=-1).
5. Ambil `argmax` dari empat skor sesuai `class_names.json`, izinkan koreksi manual/Lainnya.
6. Untuk foto browser, Canvas tidak sama persis dengan PIL LANCZOS. Bandingkan prediksi dan skor pada 10 foto yang sama sebelum integrasi final.

## Konversi ke TensorFlow.js GraphModel (di lingkungan Python yang kompatibel)
Lakukan di **virtual environment terpisah** agar tidak merusak instalasi TensorFlow/Keras Colab yang dipakai training.
Setelah memasang `tensorflowjs` dan memeriksa `tensorflowjs_converter --help`, jalankan:

```bash
tensorflowjs_converter --input_format=tf_saved_model   --output_format=tfjs_graph_model   --signature_name=serving_default   --saved_model_tags=serve   saved_model tfjs_graph_model
```

Hasil: `tfjs_graph_model/model.json` bersama weight shards. Salin **seluruh isi** folder ini ke public hosting web; muat dengan `tf.loadGraphModel(...)`, **bukan** `tf.loadLayersModel(...)`. Kompatibilitas TF.js tergantung versi converter; apabila konversi gagal jangan mengubah model final hanya demi skor test. Pilihan alternatif adalah API inferensi Python/TF Serving.

**Belum lolos uji browser bila file TF.js tidak dibuat dan prediksi browser belum diverifikasi.**

## Batasan eksperimen
- Dataset merupakan foto yang dikumpulkan sendiri di kampus dengan variasi objek dan ruangan terbatas.
- Split stratified random tanpa identitas unit/ruangan; foto mirip dari unit sama bisa muncul lintas subset.
- Metrik test bukan jaminan kinerja untuk fasilitas baru di kampus lain.
- Model empat kelas dapat salah menggolongkan objek di luar kelas, walaupun skor softmax tinggi.
- Jangan memilih ulang model atau threshold berdasarkan test setelah melihat metrik final.

Referensi:
- https://keras.io/guides/migrating_to_keras_3/
- https://github.com/tensorflow/tfjs/blob/master/tfjs-converter/README.md
