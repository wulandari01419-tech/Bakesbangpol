# main.py
import os
import io
import sqlite3
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import pandas as pd

import models
import schemas
import predictor
from database import engine, get_db, SessionLocal

# ─── Migration & Table Creation MySQL ──────────────────────────────────────────

try:
    models.Base.metadata.create_all(bind=engine)
    print("[Database] Tabel MySQL berhasil disinkronkan.")
except Exception as e:
    print("[Database Error] Gagal melakukan create_all pada MySQL:", e)


# ─── Inisialisasi Aplikasi FastAPI ────────────────────────────────────────────

app = FastAPI(
    title="SPK Konflik Sosial - Bakesbangpol Banyumas",
    description=(
        "API Sistem Pendukung Keputusan Berbasis Kecerdasan Buatan untuk Klasifikasi "
        "dan Rekomendasi Penanganan Konflik Sosial Menggunakan Pendekatan Hybrid Rule-Based "
        "dan Machine Learning."
    ),
    version="2.3.0",
)

# ─── Configuration CORS ───────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Seed Data Otomatis dari CSV ──────────────────────────────────────────────

def seed_database_if_empty(db: Session):
    try:
        count = db.query(models.RiwayatKonflik).count()
        if count == 0:
            csv_path = os.path.join(os.path.dirname(__file__), "Model", "data_konflik_cleaned_labeled.csv")
            if os.path.exists(csv_path):
                df = pd.read_csv(csv_path)
                kecamatan_list = [
                    "Ajibarang", "Banyumas", "Baturraden", "Cilongok", "Gumelar", "Jatilawang",
                    "Kalibagor", "Karanglewas", "Kebasen", "Kedungbanteng", "Kembaran", "Kemranjen",
                    "Lumbir", "Patikraja", "Pekuncen", "Purwojati", "Purwokerto Barat", "Purwokerto Selatan",
                    "Purwokerto Timur", "Purwokerto Utara", "Rawalo", "Sokaraja", "Somagede", "Sumbang",
                    "Sumpiuh", "Tambak", "Wangon"
                ]
                for _, row in df.iterrows():
                    uraian = str(row.get("URAIAN", "")).strip()
                    if not uraian or uraian.lower() == "nan":
                        continue
                    
                    found_kec = "Purwokerto Timur"
                    for kec in kecamatan_list:
                        if kec.lower() in uraian.lower():
                            found_kec = kec
                            break
                    
                    cat = str(row.get("KATEGORI", "Lainnya")).strip()
                    risk_raw = str(row.get("RISIKO_RULE", "Sedang")).strip().capitalize()
                    risk = risk_raw if risk_raw in ["Tinggi", "Sedang", "Rendah"] else "Sedang"
                    color = "merah" if risk == "Tinggi" else ("oranye" if risk == "Sedang" else "hijau")
                    pihak = str(row.get("PIHAK", "Masyarakat")).strip()
                    if pihak.lower() == "nan": pihak = "Masyarakat"
                    
                    status_fn = str(row.get("STATUS_FINAL", "Dalam Proses")).strip()
                    if status_fn.lower() in ["nan", "belum diketahui"]:
                        status_fn = "Dalam Proses"

                    rec = predictor.get_recommendation(risk, cat)
                    is_over, _ = predictor.check_rule_based(uraian)

                    record = models.RiwayatKonflik(
                        teks_input=uraian,
                        kecamatan=found_kec,
                        pihak_terlibat=pihak,
                        kategori=cat,
                        tingkat_risiko=risk,
                        warna_risiko=color,
                        rekomendasi=rec,
                        is_override=is_over,
                        status_penanganan=status_fn
                    )
                    db.add(record)
                db.commit()
    except Exception as e:
        db.rollback()
        print("Seed error:", e)


# ─── Startup Event Handler ────────────────────────────────────────────────────

@app.on_event("startup")
def startup_event():
    """Memuat model ML dan seed database ke memori saat server dinyalakan."""
    print("Memuat model ML (kategori & risiko)...")
    predictor.get_model_kategori()
    predictor.get_model_risiko()
    print("Model ML berhasil dimuat ke memori!")
    
    db = SessionLocal()
    try:
        seed_database_if_empty(db)
    finally:
        db.close()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/", tags=["Root"])
def root(db: Session = Depends(get_db)):
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "SPK Konflik Sosial API Bakesbangpol Banyumas",
        "version": "2.3.0",
        "docs": "/docs"
    }


@app.post(
    "/predict",
    response_model=schemas.PredictResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Prediksi & Rekomendasi"],
    summary="Prediksi Hybrid Konflik Sosial (Rule-Based + ML)",
)
def predict_konflik(payload: schemas.PredictRequest, db: Session = Depends(get_db)):
    """
    Endpoint utama SPK:
    1. Menerima input teks uraian laporan konflik, kecamatan, dan pihak terlibat.
    2. Memanggil fungsi `hybrid_predict()` di `predictor.py`.
    3. Menyimpan hasil klasifikasi & rekomendasi ke dalam database `riwayat_konflik`.
    4. Mengembalikan objek response lengkap.
    """
    input_text = payload.text or payload.uraian
    if not input_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teks laporan tidak boleh kosong."
        )

    try:
        res = predictor.hybrid_predict(input_text)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model Machine Learning gagal dimuat: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan sistem: {str(e)}"
        )

    # Deteksi otomatis kecamatan jika user tidak memilih khusus
    kecamatan_input = payload.kecamatan
    if not kecamatan_input or kecamatan_input == "Purwokerto Timur":
        kecamatan_list = [
            "Ajibarang", "Banyumas", "Baturraden", "Cilongok", "Gumelar", "Jatilawang",
            "Kalibagor", "Karanglewas", "Kebasen", "Kedungbanteng", "Kembaran", "Kemranjen",
            "Lumbir", "Patikraja", "Pekuncen", "Purwojati", "Purwokerto Barat", "Purwokerto Selatan",
            "Purwokerto Timur", "Purwokerto Utara", "Rawalo", "Sokaraja", "Somagede", "Sumbang",
            "Sumpiuh", "Tambak", "Wangon"
        ]
        for kec in kecamatan_list:
            if kec.lower() in input_text.lower():
                kecamatan_input = kec
                break

    # Simpan ke Database (models.RiwayatKonflik)
    db_record = models.RiwayatKonflik(
        teks_input=input_text,
        kecamatan=kecamatan_input or "Purwokerto Timur",
        pihak_terlibat=payload.pihak_terlibat or "Masyarakat / Warga",
        kategori=res["category"],
        tingkat_risiko=res["risk_level"],
        warna_risiko=res["risk_color"],
        rekomendasi=res["recommendation"],
        is_override=res["is_override"],
        status_penanganan="Dalam Proses"
    )

    try:
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
    except Exception as e:
        db.rollback()
        print("Database insert error:", e)

    return schemas.PredictResponse(
        id=getattr(db_record, "id", 1),
        text=input_text,
        kecamatan=getattr(db_record, "kecamatan", kecamatan_input or "Purwokerto Timur"),
        pihak_terlibat=getattr(db_record, "pihak_terlibat", payload.pihak_terlibat or "Masyarakat"),
        category=res["category"],
        risk_level=res["risk_level"],
        risk_color=res["risk_color"],
        recommendation=res["recommendation"],
        is_override=res["is_override"],
        status_penanganan="Dalam Proses",
        keywords_detected=res.get("keywords_detected", []),
        created_at=getattr(db_record, "created_at", None)
    )


@app.get(
    "/history",
    response_model=List[schemas.HistoryResponse],
    tags=["Riwayat Konflik"],
    summary="Ambil Riwayat Prediksi & Rekomendasi",
)
def get_history(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    """Mengambil riwayat data analisis dan rekomendasi dari database."""
    seed_database_if_empty(db)
    try:
        records = (
            db.query(models.RiwayatKonflik)
            .order_by(models.RiwayatKonflik.created_at.desc(), models.RiwayatKonflik.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return records
    except Exception as e:
        print("Fetch history error:", e)
        return []


@app.patch(
    "/history/{record_id}/status",
    response_model=schemas.HistoryResponse,
    tags=["Riwayat Konflik"],
    summary="Update status penanganan konflik di lapangan",
)
def update_status_penanganan(
    record_id: int,
    payload: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    """Memperbarui status penanganan konflik (Dalam Proses / Mediasi / Tertangani)."""
    record = db.query(models.RiwayatKonflik).filter(models.RiwayatKonflik.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Riwayat dengan ID {record_id} tidak ditemukan."
        )
    record.status_penanganan = payload.status_penanganan
    db.commit()
    db.refresh(record)
    return record


@app.delete(
    "/history/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Riwayat Konflik"],
    summary="Hapus satu data riwayat",
)
def delete_history_item(record_id: int, db: Session = Depends(get_db)):
    """Menghapus item riwayat berdasarkan ID."""
    record = db.query(models.RiwayatKonflik).filter(models.RiwayatKonflik.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Riwayat dengan ID {record_id} tidak ditemukan."
        )
    db.delete(record)
    db.commit()
    return None


@app.delete(
    "/history",
    status_code=status.HTTP_200_OK,
    tags=["Riwayat Konflik"],
    summary="Bersihkan seluruh data riwayat",
)
def clear_all_history(db: Session = Depends(get_db)):
    """Menghapus seluruh catatan riwayat prediksi dari database."""
    num_deleted = db.query(models.RiwayatKonflik).delete()
    db.commit()
    return {"message": f"Berhasil menghapus {num_deleted} riwayat."}


@app.get(
    "/export/excel",
    tags=["Ekspor Data"],
    summary="Ekspor Rekapitulasi Laporan Konflik ke Excel (.xlsx)",
)
def export_excel(db: Session = Depends(get_db)):
    """Menghasilkan dan mengunduh file Excel rekapitulasi data konflik."""
    try:
        records = db.query(models.RiwayatKonflik).order_by(models.RiwayatKonflik.created_at.desc(), models.RiwayatKonflik.id.desc()).all()
    except Exception:
        records = []
    
    data = []
    for idx, r in enumerate(records, 1):
        data.append({
            "No": idx,
            "Waktu Input": r.created_at.strftime("%Y-%m-%d %H:%M") if getattr(r, 'created_at', None) else "-",
            "Kecamatan": getattr(r, 'kecamatan', '-') or "-",
            "Pihak Terlibat": getattr(r, 'pihak_terlibat', '-') or "-",
            "Uraian Kejadian": getattr(r, 'teks_input', '-'),
            "Kategori Konflik": getattr(r, 'kategori', '-'),
            "Tingkat Risiko": getattr(r, 'tingkat_risiko', '-'),
            "Metode Analyst": "Rule-Based Override" if getattr(r, 'is_override', False) else "Machine Learning",
            "Status Penanganan": getattr(r, 'status_penanganan', 'Dalam Proses') or "Dalam Proses",
            "Rekomendasi Penanganan": getattr(r, 'rekomendasi', '-')
        })
    
    if not data:
        data.append({
            "No": 1, "Waktu Input": "-", "Kecamatan": "-", "Pihak Terlibat": "-",
            "Uraian Kejadian": "Belum ada data", "Kategori Konflik": "-", "Tingkat Risiko": "-",
            "Metode Analyst": "-", "Status Penanganan": "-", "Rekomendasi Penanganan": "-"
        })

    df = pd.DataFrame(data)
    stream = io.BytesIO()
    with pd.ExcelWriter(stream, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Rekapitulasi Konflik")
    stream.seek(0)

    headers = {
        "Content-Disposition": "attachment; filename=Rekapitulasi_Konflik_Bakesbangpol_Banyumas.xlsx"
    }
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )
