# ═══════════════════════════════════════════════════════════
# MUSA Shop — bot sozlamalari
#
# Frontend tomonidagi mos fayllar:
#   src/config/brand.ts     — bot username, aloqa ma'lumotlari
#   src/config/firebase.ts  — Firebase web config
#
# MAXFIY qiymatlar (BOT_TOKEN) bu faylda EMAS — ular `bot/.env`
# faylida turadi, u esa .gitignore'da. Namuna: bot/.env.example
# ═══════════════════════════════════════════════════════════
import os
from pathlib import Path


def _load_env() -> None:
    """
    bot/.env faylini o'qib, os.environ ga yozadi.

    python-dotenv qo'shmaslik uchun qo'lda: bot yagona bog'liqligi
    aiogram bo'lib qolsin. Allaqachon mavjud env o'zgaruvchisi
    ustidan yozilmaydi — server muhitida env kuchliroq bo'ladi.
    """
    path = Path(__file__).with_name(".env")
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env()

# ── Telegram ──
# Token .env dan keladi. Bo'sh bo'lsa bot ishga tushmaydi (bot.py tekshiradi).
BOT_TOKEN    = os.environ.get("BOT_TOKEN", "")
# TODO(MUSA): @BotFather dagi haqiqiy username
BOT_USERNAME = "musa_shop_bot"
# TODO(MUSA): MUSA adminlarining Telegram ID lari (@userinfobot beradi)
ADMIN_IDS    = {7203124812}   # Egalar — panel orqali o'chirib bo'lmaydi
# TODO(MUSA): Vercel'dagi haqiqiy domen + BotFather /setdomain
MINI_APP_URL = "https://musa-shop.vercel.app"

# ── Kompaniya aloqa ma'lumotlari (bot javoblarida ko'rinadi) ──
# TODO(MUSA): quyidagi aloqa qiymatlari bo'sh joy tutuvchi — to'ldiring.
# Frontend tomonidagi nusxasi: src/config/brand.ts
COMPANY_NAME     = "MUSA"
COMPANY_TAGLINE  = "Yarim tayyor mahsulotlar"
SUPPORT_PHONE    = "+998 00 000 00 00"
SUPPORT_EMAIL    = "info@musa.uz"
SUPPORT_TELEGRAM = "@musa_uz"
COMPANY_CITY     = "Toshkent, O'zbekiston"
WORK_HOURS       = "09:00 — 20:00"

# ── Firebase ──
# Service account JSON fayli (loyiha ildizida yoki bot/ papkasida).
# Firebase Console → Project Settings → Service accounts →
# "Generate new private key". Fayl .gitignore'da.
# TODO(MUSA): MUSA loyihasidan yuklab olingan JSON faylning nomi.
FIREBASE_KEY_FILE       = "musa-firebase-adminsdk.json"
# Storage bucket — mahsulot rasmlari shu yerga yuklanadi.
# Console → Storage → bucket nomi (odatda <project-id>.firebasestorage.app).
# TODO(MUSA): src/config/firebase.ts dagi storageBucket bilan BIR XIL bo'lsin.
FIREBASE_STORAGE_BUCKET = "TODO-musa.firebasestorage.app"

# ── Server ──
API_HOST     = "0.0.0.0"
API_PORT     = 8080
IMAGES_DIR   = "images"
DB_FILE      = "database.json"

# To'lov sozlamalari — faqat BOSHLANG'ICH qiymat.
# Bot birinchi ishga tushganda bular Firestore'dagi settings/payment
# hujjatiga ko'chiriladi. Undan keyin haqiqiy manba — o'sha hujjat (F-07).
# TODO(MUSA): MUSA ning haqiqiy kartasi va egasining ismi.
CARD_NUMBER = "0000 0000 0000 0000"
CARD_OWNER  = "MUSA"
