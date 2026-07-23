# SPK Klasifikasi dan Rekomendasi Penanganan Konflik Sosial (Hybrid Rule-Based & ML)

> **Judul Skripsi**: Rancang Bangun Sistem Pendukung Keputusan Berbasis Kecerdasan Buatan untuk Klasifikasi dan Rekomendasi Penanganan Konflik Sosial Menggunakan Pendekatan Hybrid Rule-Based dan Machine Learning  
> **Instansi**: Badan Kesatuan Bangsa dan Politik (BAKESBANGPOL) Kabupaten Banyumas

---

## 📐 Arsitektur & Struktur Proyek

Proyek ini terbagi menjadi dua komponen utama: **Backend** (API Python FastAPI & Machine Learning) dan **Frontend** (Web Application User Interface).

```text
Bakesbangpol/
├── Backend/
│   ├── Model/
│   │   ├── model_kategori.pkl          # Model ML Klasifikasi Kategori Konflik
│   │   ├── model_risiko.pkl            # Model ML Klasifikasi Tingkat Risiko
│   │   └── data_konflik_cleaned...csv  # Dataset Histori Konflik (Training & Benchmark)
│   ├── database.py                     # Konfigurasi Sesi Database SQLAlchemy (SQLite)
│   ├── models.py                       # Model ORM Tabel 'riwayat_konflik'
│   ├── predictor.py                    # Logika Hybrid (Rule-Based Override & Prediksi ML)
│   ├── schemas.py                      # Pydantic Schemas untuk Request/Response API
│   ├── main.py                         # Entry point FastAPI REST API (/predict, /history)
│   └── requirements.txt                # Daftar Dependency Python
│
├── Frontend/
│   ├── index.html                      # Halaman Antarmuka Web Utama (SPA)
│   ├── styles.css                      # Styling Modern (Dark/Light Mode & Color Badges)
│   └── app.js                          # Integrasi REST API & Fitur Cetak Rekomendasi
│
├── .gitignore                          # Konfigurasi Pengabaian File Compile & Cache
└── README.md                           # Dokumentasi Proyek Skripsi
```

---

## ⚡ Cara Menjalankan Aplikasi

### 1. Menjalankan Backend (FastAPI Python)
Buka terminal / Command Prompt:
```cmd
cd /d C:\data\Bakesbangpol\Backend
uvicorn main:app --reload --port 8000
```
- **REST API Endpoint**: `http://localhost:8000`
- **Dokumentasi Swagger Interaktif**: `http://localhost:8000/docs`

### 2. Menjalankan Frontend (Web App)
#### Cara A (Langsung dari Browser):
Double click file `Frontend/index.html` atau buka browser dan masukan URL:
```text
file:///C:/data/Bakesbangpol/Frontend/index.html
```

#### Cara B (Menggunakan Python HTTP Server):
Buka terminal baru:
```cmd
cd /d C:\data\Bakesbangpol\Frontend
python -m http.server 3000
```
Akses di browser: `http://localhost:3000`

---

## 🧠 Fitur Utama Hybrid System
1. **Machine Learning Klasifikasi**: Mengklasifikasikan kategori konflik dan memprediksi tingkat risiko (Rendah / Sedang / Tinggi).
2. **Rule-Based Override (Darurat)**: Mengamankan penanganan dengan meng-override risiko menjadi **Tinggi (Merah)** jika terdeteksi kata kunci kekerasan/darurat pada laporan.
3. **Rekomendasi Penanganan Lapangan**: Menghasilkan instruksi tindakan konkret untuk Satgas Bakesbangpol sesuai tingkat risiko.
4. **Riwayat & Cetak Laporan**: Menyimpan histori analisis ke database SQLite dan dapat dicetak sebagai Lembar Rekomendasi Resmi.
