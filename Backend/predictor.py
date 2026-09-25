# predictor.py
import os
import joblib
import warnings

# Suppress sklearn version mismatch warnings saat load model
warnings.filterwarnings("ignore", category=UserWarning)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "Model")

MODEL_KATEGORI_PATH = os.path.join(MODEL_DIR, "model_kategori.pkl")
MODEL_RISIKO_PATH = os.path.join(MODEL_DIR, "model_risiko.pkl")

# Kata kunci darurat/kekerasan untuk Rule-Based Override
EMERGENCY_KEYWORDS = [
    "senjata", "darah", "anarkis", "pembunuhan", "bentrok", "penembakan",
    "kerusuhan", "korban jiwa", "bakar", "bom", "senjata tajam", "sajam",
    "bacok", "tawuran", "rusuh", "tewas", "meninggal", "kekerasan", "senjata api",
    "amuk", "penyerangan", "jarah", "penjarahan", "penganiayaan", "korban"
]

_model_kategori = None
_model_risiko = None


def _load_model(path: str):
    """Muat model dari file .pkl dengan pengecekan keberadaan file."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"File model tidak ditemukan di: {path}")
    return joblib.load(path)


def get_model_kategori():
    global _model_kategori
    if _model_kategori is None:
        _model_kategori = _load_model(MODEL_KATEGORI_PATH)
    return _model_kategori


def get_model_risiko():
    global _model_risiko
    if _model_risiko is None:
        _model_risiko = _load_model(MODEL_RISIKO_PATH)
    return _model_risiko


def check_rule_based(text: str) -> tuple[bool, list[str]]:
    """
    Memeriksa keberadaan kata kunci kekerasan/darurat pada teks input.
    Mengembalikan (is_override, keywords_found).
    """
    text_lower = text.lower()
    found_keywords = [kw for kw in EMERGENCY_KEYWORDS if kw in text_lower]
    return (len(found_keywords) > 0, found_keywords)


def get_recommendation(risk_level: str, category: str = "") -> str:
    """
    Menghasilkan rekomendasi tindakan penanganan berdasarkan tingkat risiko dan kategori.
    """
    if risk_level == "Tinggi":
        return (
            "TINDAKAN DARURAT (RISIKO TINGGI): Segera lakukan koordinasi cepat dengan Tim Satgas Penanganan "
            "Konflik Bakesbangpol, Pihak Kepolisian (Polres/Polsek), dan TNI. Lakukan sterilisasi dan pengamanan "
            "lokasi kejadian, evakuasi korban/warga terdampak, serta buka posko siaga darurat."
        )
    elif risk_level == "Sedang":
        return (
            "TINDAKAN PREVENTIF & MEDIASI (RISIKO SEDANG): Segera fasilitasi dialog/mediasi resmi antar pihak "
            "yang bersengketa dengan melibatkan Pihak Kecamatan/ Muspika Tokoh Masyarakat, dan Aparat Desa. "
            "Tingkatkan pemantauan lapangan untuk mencegah eskalasi."
        )
    else:  # Rendah
        return (
            "PEMANTAUAN & EDUKASI (RISIKO RENDAH): Lakukan pengawasan dan deteksi dini secara berkala oleh tim "
            "lapangan Bakesbangpol. Lakukan pendekatan persuasif serta sosialisasi literasi resolusi konflik kepada masyarakat."
        )


def hybrid_predict(text: str) -> dict:
    """
    Fungsi hybrid yang menggabungkan Rule-Based Override dan Machine Learning.

    Args:
        text: Teks laporan/uraian konflik.

    Returns:
        dict berisi: category, risk_level, risk_color, recommendation, is_override, keywords_detected
    """
    if not text or not text.strip():
        raise ValueError("Teks laporan konflik tidak boleh kosong.")

    clean_text = text.strip()

    # 1. Prediksi Kategori menggunakan Machine Learning
    model_kat = get_model_kategori()
    pred_kat = str(model_kat.predict([clean_text])[0])

    # 2. Rule-Based Override Check untuk Risiko
    is_override, keywords_found = check_rule_based(clean_text)

    if is_override:
        risk_level = "Tinggi"
        risk_color = "merah"
    else:
        # Jika tidak ada trigger rule-based, gunakan prediksi Machine Learning
        model_ris = get_model_risiko()
        pred_ris = str(model_ris.predict([clean_text])[0])

        # Normalisasi label risiko jika perlu
        pred_ris_capital = pred_ris.strip().capitalize()
        if pred_ris_capital in ["Tinggi", "Sedang", "Rendah"]:
            risk_level = pred_ris_capital
        else:
            risk_level = pred_ris

        # Pemetaan warna risiko
        if risk_level == "Tinggi":
            risk_color = "merah"
        elif risk_level == "Sedang":
            risk_color = "oranye"
        else:
            risk_color = "hijau"

    # 3. Rekomendasi tindakan penanganan
    recommendation = get_recommendation(risk_level, pred_kat)

    return {
        "category": pred_kat,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "recommendation": recommendation,
        "is_override": is_override,
        "keywords_detected": keywords_found
    }


# Backwards compatibility alias
prediksi_semua = hybrid_predict
