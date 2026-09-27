import sys
import os

# Tambahkan folder Backend ke sys.path agar modul internal seperti models, schemas, database dapat di-import
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "Backend"))

from Backend.main import app

# Export app untuk Vercel Serverless Function
