# schemas.py
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime


# ─── Request Schemas ──────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Schema request untuk memprediksi laporan konflik."""
    text: Optional[str] = Field(None, min_length=5, description="Teks uraian kejadian/konflik")
    uraian: Optional[str] = Field(None, min_length=5, description="Alias untuk field text")
    kecamatan: Optional[str] = Field("Purwokerto Timur", description="Kecamatan lokasi kejadian di Kab. Banyumas")
    pihak_terlibat: Optional[str] = Field(None, description="Pihak-pihak yang terlibat dalam konflik")

    @model_validator(mode="before")
    @classmethod
    def check_text_or_uraian(cls, data):
        if isinstance(data, dict):
            if not data.get("text") and data.get("uraian"):
                data["text"] = data.get("uraian")
            elif not data.get("text") and not data.get("uraian"):
                raise ValueError("Field 'text' atau 'uraian' wajib diisi.")
        return data

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Terjadi aksi penyampaian pendapat warga terkait sengketa batas lahan di Desa Karangmangu.",
                "kecamatan": "Baturraden",
                "pihak_terlibat": "Warga Desa vs Pengembang Swasta"
            }
        }


class StatusUpdateRequest(BaseModel):
    """Schema request untuk mengupdate status penanganan konflik."""
    status_penanganan: str = Field(..., description="Status baru: 'Dalam Proses', 'Mediasi', atau 'Tertangani'")


# ─── Response Schemas ─────────────────────────────────────────────────────────

class PredictResponse(BaseModel):
    """Schema response hasil hybrid_predict() beserta simpanan riwayat."""
    id: Optional[int] = None
    text: str
    kecamatan: Optional[str] = "Purwokerto Timur"
    pihak_terlibat: Optional[str] = None
    category: str
    risk_level: str
    risk_color: str
    recommendation: str
    is_override: bool = False
    status_penanganan: str = "Dalam Proses"
    keywords_detected: List[str] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HistoryResponse(BaseModel):
    """Schema response data riwayat dari database."""
    id: int
    teks_input: str
    kecamatan: Optional[str] = "Purwokerto Timur"
    pihak_terlibat: Optional[str] = None
    kategori: str
    tingkat_risiko: str
    warna_risiko: str
    rekomendasi: str
    is_override: bool
    status_penanganan: Optional[str] = "Dalam Proses"
    created_at: datetime

    class Config:
        from_attributes = True
