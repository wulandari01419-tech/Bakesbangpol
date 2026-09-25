# models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class RiwayatKonflik(Base):
    """Model database ORM untuk menyimpans riwayat masukan laporan konflik & hasil prediksi/rekomendasi."""
    __tablename__ = "riwayat_konflik"

    id = Column(Integer, primary_key=True, index=True)
    teks_input = Column(Text, nullable=False)
    kecamatan = Column(String(100), nullable=True, default="Purwokerto Timur")
    pihak_terlibat = Column(String(255), nullable=True)
    kategori = Column(String(255), nullable=True)
    tingkat_risiko = Column(String(50), nullable=True)
    warna_risiko = Column(String(50), nullable=True)
    rekomendasi = Column(Text, nullable=True)
    is_override = Column(Boolean, default=False)
    status_penanganan = Column(String(50), default="Dalam Proses")

    created_at = Column(DateTime(timezone=True), server_default=func.now())


# Alias untuk kompatibilitas jika diperlukan
KonflikRecord = RiwayatKonflik
