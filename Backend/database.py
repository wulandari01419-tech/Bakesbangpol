# database.py
import os
import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Konfigurasi Koneksi MySQL XAMPP
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "bakesbangpol_db")

def ensure_mysql_database_exists():
    """Membuat database MySQL jika belum ada di server XAMPP."""
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            autocommit=True
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.close()
        print(f"[Database] MySQL Database `{DB_NAME}` dipastikan siap di {DB_HOST}:{DB_PORT}.")
    except Exception as e:
        print(f"[Database Warning] Gagal membuat/memverifikasi database MySQL XAMPP: {e}")

# Pastikan DB ada di MySQL XAMPP
ensure_mysql_database_exists()

# String koneksi MySQL SQLAlchemy
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=10,
        max_overflow=20
    )
except Exception as err:
    print("[Database Error] Gagal menginisialisasi SQLAlchemy MySQL Engine:", err)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency FastAPI untuk mendapatkan sesi koneksi database."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

