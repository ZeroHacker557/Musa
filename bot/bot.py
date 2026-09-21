"""
MUSA Shop Telegram Bot — Mini App + To'lov tizimi

MUSA — muzlatilgan mahsulotlar do'koni: yarim tayyor, muzqaymoq, sirok.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import time

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, WebAppInfo, InlineKeyboardButton,
    InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton,
    MenuButtonWebApp, CallbackQuery
)
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.client.default import DefaultBotProperties

# Karta ma'lumoti config.py dan emas, settings/payment hujjatidan olinadi (F-07)
from config import (
    BOT_TOKEN, MINI_APP_URL, ADMIN_PANEL_URL,
    SUPPORT_PHONE, SUPPORT_EMAIL, SUPPORT_TELEGRAM, COMPANY_CITY, WORK_HOURS,
)
# Adminlar ro'yxati dinamik — panel orqali qo'shiladi/o'chiriladi
from admins import all_admins, is_admin, can_open_panel
import firebase_db as db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Token bot/.env dan keladi. Bo'lmasa aiogram tushunarsiz xato beradi —
# shuning uchun oldindan aniq xabar bilan to'xtatamiz.
if not BOT_TOKEN:
    raise SystemExit(
        "BOT_TOKEN topilmadi.\n"
        "bot/.env faylini yarating va tokenni yozing:\n"
        "    cp bot/.env.example bot/.env\n"
        "Token @BotFather dan olinadi."
    )

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="HTML"))
dp  = Dispatcher(storage=MemoryStorage())


# ─── FSM ─────────────────────────────────────────────────────

class PaymentUpload(StatesGroup):
    waiting_photo = State()


# ─── Klaviaturalar ────────────────────────────────────────────

def main_kb(admin: bool = False):
    rows = [
        # Oddiy tugma — bosilganda pastdagi menyu tugmasiga yo'naltiradi.
        # Mini app faqat yozuv maydoni yonidagi "🥟 Katalog" orqali ochiladi.
        [KeyboardButton(text="🥟 Katalogni ochish")],
        [KeyboardButton(text="📦 Buyurtmalarim")],
        [KeyboardButton(text="📞 Biz bilan aloqa"), KeyboardButton(text="ℹ️ Yordam")]
    ]
    # Admin panel tugmasi FAQAT adminlarda: oddiy mijoz uni umuman
    # ko'rmaydi. Bosilganda panel shu yerning o'zida ochiladi.
    if admin:
        rows.insert(0, [KeyboardButton(text=PANEL_BUTTON)])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


PANEL_BUTTON = "🛠 Admin panel"


def panel_kb() -> InlineKeyboardMarkup:
    """
    Admin panelni ochadigan tugma — oddiy HAVOLA.

    Ilgari bu `web_app` tugmasi edi: panel Telegram oynasida ochilardi.
    Kompyuterda o'sha oyna telefon o'lchamida qolib ketardi, to'liq
    ekran esa Telegram versiyasiga bog'liq bo'lib, hamma joyda
    ishlamasdi. Oddiy havola brauzerni ochadi va panel butun ekranni
    egallaydi — admin uchun ish shu tarzda qulayroq.

    Kirish har safar so'ralmaydi: admin bir marta email/parol bilan
    kiradi, brauzer seansi saqlanadi.
    """
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text=PANEL_BUTTON,
        url=ADMIN_PANEL_URL,
    )]])


PANEL_TEXT = (
    "🛠 <b>Admin panel</b>\n"
    "——————————————\n\n"
    "Buyurtmalar, mahsulotlar, hisobotlar va sozlamalar — hammasi shu yerda.\n\n"
    "👇 Tugmani bosing — panel brauzerda, butun ekran bo‘ylab ochiladi.\n"
    "<i>Birinchi marta email va parol so'raladi, keyin esa o'zi kirib turadi.</i>"
)


def contact_kb() -> ReplyKeyboardMarkup:
    """Telefon raqamini bir bosishda olish uchun (F-26)."""
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def location_button(order_id: str) -> InlineKeyboardButton:
    """
    Bosilganda mijoz manzilini HAQIQIY Telegram lokatsiyasi sifatida
    yuboradi (havola emas). Uni kuryerga oddiy forward qilish mumkin.
    """
    return InlineKeyboardButton(
        text="📍 Lokatsiyani olish",
        callback_data=f"loc:{order_id}",
    )


def order_action_kb(order_id: str, has_location: bool = False) -> InlineKeyboardMarkup:
    """Admin uchun status tugmalari (+ lokatsiya, agar bo'lsa)"""
    rows = [
        [
            InlineKeyboardButton(text="✅ Qabul",     callback_data=f"os:Qabul qilindi:{order_id}"),
            InlineKeyboardButton(text="🚚 Yetkazish", callback_data=f"os:Yetkazilmoqda:{order_id}")
        ],
        [
            InlineKeyboardButton(text="🎉 Bajarildi", callback_data=f"os:Yetkazildi:{order_id}"),
            InlineKeyboardButton(text="❌ Rad etish", callback_data=f"os:Rad etildi:{order_id}")
        ],
    ]
    if has_location:
        rows.append([location_button(order_id)])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def catalog_kb() -> InlineKeyboardMarkup:
    """
    Katalogni ochadigan inline tugma.

    Mijoz «🥟 Katalogni ochish» ni bosganda shu tugma chiqadi va
    do'kon bir bosishda ochiladi. Ilgari faqat «pastdagi menyu
    tugmasini toping» degan matn chiqardi — ko'pchilik o'sha tugmani
    topolmay qaytib ketardi.
    """
    return InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text="🥟 Katalogni ochish",
        web_app=WebAppInfo(url=MINI_APP_URL),
        # Tugma foni yashil (Bot API 9.4, `style`: danger/success/primary).
        # aiogram 3.13 bu maydonni bilmaydi, lekin qo'shimcha maydonlarni
        # o'tkazib yuboradi — Telegram'ga shundayligicha boradi. Eski
        # mijozlar uni e'tiborsiz qoldiradi: tugma odatdagi rangda chiqadi.
        style="success",
    )]])


def order_has_location(order: dict | None) -> bool:
    loc = (order or {}).get("customer", {}).get("location") or {}
    return isinstance(loc, dict) and loc.get("lat") is not None and loc.get("lng") is not None


def receipt_kb(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 To'lov chekini yuborish", callback_data=f"receipt:{order_id}")]
    ])


def resend_receipt_kb(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Qayta chek yuborish", callback_data=f"receipt:{order_id}")]
    ])


def payment_confirm_kb(order_id: str, user_id: int, has_location: bool = False) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"pconf:ok:{order_id}:{user_id}"),
            InlineKeyboardButton(text="❌ Rad etish",  callback_data=f"pconf:no:{order_id}:{user_id}")
        ],
    ]
    if has_location:
        rows.append([location_button(order_id)])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def mini_app_kb() -> InlineKeyboardMarkup:
    # Yorliq «Buyurtmalarimni ko'rish» bo'lgani uchun havola ham
    # ilovaning aynan shu bo'limini ochadi.
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🛍 Buyurtmalarimni ko'rish",
            web_app=WebAppInfo(url=f"{MINI_APP_URL}?page=orders"),
        )]
    ])


# ─── Yordamchi funksiyalar ────────────────────────────────────

def get_display_name(order_data: dict) -> str:
    raw = order_data.get("username", "")
    if raw and " " not in raw.strip():
        return f"@{raw}"
    return raw or order_data.get("customer", {}).get("name", "—")


def get_products_text(products: list) -> str:
    lines = ""
    for i, p in enumerate(products, 1):
        qty      = p.get("quantity", 1)
        size     = p.get("size")
        color    = p.get("color")
        prod     = p.get("product") or p
        name     = prod.get("name", "—")
        price    = prod.get("price", 0)
        item_sum = db.format_price(price * qty)
        
        variant_info = []
        if size: variant_info.append(f"Vazn: {size}")
        if color: variant_info.append(f"Turi: {color}")
        var_text = f" ({', '.join(variant_info)})" if variant_info else ""
        
        lines += f"  <b>{i}. {name}</b>{var_text}\n"
        lines += f"     └ {qty} ta × {db.format_price(price)} = <b>{item_sum}</b>\n"
    return lines


# Telegram rasm izohi (caption) uchun chegara
CAPTION_LIMIT = 1024


def current_caption(msg) -> str:
    """Rasmli xabarning HTML izohi (formatlash saqlanadi)."""
    try:
        return msg.html_text or ""
    except Exception:
        return msg.caption or ""


def build_receipt_caption(order: dict | None, display_id: str) -> str:
    """
    Adminga yuboriladigan chek izohi: mijoz ma'lumotlari, mahsulotlar
    (turi va vazni bilan) hamda to'liq hisob-kitob.

    Telegram izohni 1024 belgi bilan cheklaydi — sig'masa mahsulotlar
    ro'yxati qisqartiriladi, mijoz ma'lumotlari esa doim to'liq qoladi.
    """
    head = "💳 <b>TO'LOV CHEKI</b>\n" + "━" * 22 + "\n\n"
    head += f"🧾 <b>Buyurtma:</b> {display_id}\n"

    if not order:
        return head + "\n⚠️ Buyurtma ma'lumotlari topilmadi."

    customer = order.get("customer", {})
    head += f"📅 {db.order_date_text(order)}\n\n"
    head += f"👤 <b>Ism:</b> {customer.get('name', '—')}\n"
    head += f"📱 <b>Telegram:</b> {get_display_name(order)}\n"
    head += f"📞 <b>Tel:</b> <code>{customer.get('phone', '—')}</code>\n"
    head += f"📍 <b>Manzil:</b> {customer.get('address', '—')}\n"
    if customer.get("comment"):
        head += f"💬 <b>Izoh:</b> {customer['comment']}\n"

    # ── Hisob-kitob ──
    tail = "\n" + "━" * 22 + "\n"
    subtotal = order.get("subtotal")
    discount = order.get("discount") or 0
    delivery_fee = order.get("deliveryFee") or 0
    if isinstance(subtotal, (int, float)) and (discount or delivery_fee):
        tail += f"🧾 Mahsulotlar: {db.format_price(subtotal)}\n"
        if discount:
            promo = order.get("promoCode")
            promo_text = f" ({promo})" if promo else ""
            tail += f"🏷 Chegirma{promo_text}: -{db.format_price(discount)}\n"
        if delivery_fee:
            tail += f"🚚 Yetkazish: {db.format_price(delivery_fee)}\n"
        else:
            tail += "🚚 Yetkazish: bepul\n"

    total = order.get("total", 0)
    total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)
    tail += f"💰 <b>To'langan summa: {total_str}</b>"

    # ── Mahsulotlar ──
    products = order.get("products", [])
    lines = []
    for i, item in enumerate(products, 1):
        qty = item.get("quantity", 1)
        prod = item.get("product") or item
        name = prod.get("name", "—")
        price = prod.get("price", 0)

        variant = []
        if item.get("size"):
            variant.append(f"Vazn: {item['size']}")
        if item.get("color"):
            variant.append(f"Turi: {item['color']}")
        var_text = f" ({', '.join(variant)})" if variant else ""

        lines.append(
            f"  <b>{i}. {name}</b>{var_text}\n"
            f"     └ {qty} ta × {db.format_price(price)} = <b>{db.format_price(price * qty)}</b>\n"
        )

    body_header = "\n📦 <b>Mahsulotlar:</b>\n"
    shown = list(lines)
    while shown:
        hidden = len(lines) - len(shown)
        more = f"  <i>...va yana {hidden} ta mahsulot</i>\n" if hidden else ""
        caption = head + body_header + "".join(shown) + more + tail
        if len(caption) <= CAPTION_LIMIT:
            return caption
        shown.pop()

    return head + body_header + f"  <i>{len(lines)} ta mahsulot</i>\n" + tail


# ─── Yangi buyurtma: Admin + User bildirishnomasi ─────────────

async def notify_admin_cancel(order_data: dict):
    """Mijoz buyurtmani bekor qilganda adminga xabar (5-band)."""
    try:
        customer = order_data.get("customer", {})
        display_id = db.order_display_id(order_data)
        total = order_data.get("total", 0)
        total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)

        cust_name = customer.get("name") or "—"
        cust_phone = customer.get("phone") or "—"

        text = f"\u274c <b>BUYURTMA BEKOR QILINDI</b>\n"
        text += "\u2501" * 22 + "\n\n"
        text += f"\U0001f9fe Buyurtma: <b>{display_id}</b>\n"
        text += f"\U0001f464 Mijoz: {cust_name}\n"
        text += f"\U0001f4de Tel: <code>{cust_phone}</code>\n"
        text += f"\U0001f4b0 Summa: <b>{total_str}</b>\n\n"
        text += "\U0001f4e6 <b>Mahsulotlar:</b>\n"
        for item in order_data.get("products", []):
            prod = item.get("product") or item
            text += f"  \u2022 {prod.get('name', '?')} \u00d7 {item.get('quantity', 1)}\n"
        text += "\n<i>Mijozning o'zi bekor qildi. Ombor qoldig'i qaytarildi.</i>"

        for admin_id in all_admins():
            try:
                await bot.send_message(admin_id, text)
            except Exception as e:
                logger.warning(f"[CANCEL] {admin_id} ga yuborib bo'lmadi: {e}")

        logger.info(f"[CANCEL] {display_id} bekor qilindi")
    except Exception as e:
        logger.error(f"[CANCEL] xato: {e}", exc_info=True)


# ─── Status o'zgartirish → Usergа xabar ──────────────────────

# ─── Admin tugmalari ───────────────────────────────
#
# Yangi buyurtma tushganda admin panel (Vercel) adminlarga shaxsiy
# xabar yuboradi: tavsilotlar + «✅ Qabul qilindi» va «🖥 Admin
# paneldan ochish» tugmalari. Birinchisini shu yerda ishlaymiz.


async def api_order_status(telegram_id: int, order_id: str, status: str):
    """
    Admin panelning `/api/admin/action` funksiyasini chaqiradi.

    Nega bot o'zi Firestore'ga yozmaydi? Holat o'zgarishi yolg'iz
    yozuv emas: tarix qo'shiladi, kuryerga/guruhga xabar ketadi,
    mijozga bildirishnoma boradi, boshqa adminlarning tugmasi
    yangilanadi. Bularning hammasi allaqachon TypeScript'da yozilgan.
    Botda qayta yozilsa ikki nusxa paydo bo'lib, vaqt o'tib
    bir-biridan farq qilib ketardi.

    So'rov BOT_TOKEN bilan imzolanadi — server shu imzoga qarab
    «bu haqiqatan bizning botimiz» deb ishonadi, kim bosgani esa
    `staff.telegramId` bo'yicha topiladi.
    """
    ts = str(int(time.time()))
    payload = f"{telegram_id}.order.status.{order_id}.{ts}"
    signature = hmac.new(
        BOT_TOKEN.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()

    url = f"{MINI_APP_URL.rstrip('/')}/api/admin/action"
    body = {"action": "order.status", "orderId": order_id, "status": status}
    headers = {
        "Content-Type": "application/json",
        "x-bot-actor": str(telegram_id),
        "x-bot-ts": ts,
        "x-bot-signature": signature,
    }

    timeout = aiohttp.ClientTimeout(total=20)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.post(url, json=body, headers=headers) as response:
            try:
                data = await response.json()
            except Exception:
                data = {"error": await response.text()}
            return response.status, data


@dp.callback_query(F.data.startswith("adm:"))
async def cb_admin(callback: CallbackQuery):
    _, action, order_id = callback.data.split(":", 2)

    if action != "acc":
        await callback.answer()
        return

    await callback.answer("Yuborilmoqda…")

    try:
        code, data = await api_order_status(
            callback.from_user.id, order_id, "Qabul qilindi"
        )
    except Exception as e:
        logger.error(f"[ADMIN] {order_id} tasdiqlanmadi: {e}", exc_info=True)
        await callback.answer(
            "Server bilan bog'lanib bo'lmadi — admin paneldan urinib ko'ring",
            show_alert=True,
        )
        return

    if code != 200:
        message = (data or {}).get("error") or "Bajarilmadi"
        await callback.answer(message, show_alert=True)
        return

    if data.get("unchanged"):
        await callback.answer("Bu buyurtma allaqachon tasdiqlangan")
    else:
        await callback.answer("✅ Tasdiqlandi — kuryerga yuborildi")

    # Tugmani server o'zi yangilaydi (refreshAdminMessages). Lekin xabar
    # boshqa adminga yuborilmagan bo'lishi ham mumkin — masalan admin
    # buyurtmani /start dan keyin qo'lda topgan. Shunda hech bo'lmasa
    # bosilgan xabarni o'zimiz yangilaymiz.
    try:
        await callback.message.edit_reply_markup(
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="✅ Qabul qilindi", callback_data="noop")]
            ])
        )
    except Exception:
        pass


# ─── Kuryer tugmalari ────────────────────────────────────────
#
# Buyurtma «Qabul qilindi» bo'lganda admin panel (api/_lib/actions/
# orders.ts → dispatchToCouriers) kuryerlarga «Oldim» tugmasi bilan
# xabar yuboradi. Tugmalarni shu yerda qayta ishlaymiz.

@dp.callback_query(F.data.startswith("crr:"))
async def cb_courier(callback: CallbackQuery):
    _, action, order_id = callback.data.split(":", 2)

    courier = db.get_courier_by_telegram(callback.from_user.id)
    if not courier:
        await callback.answer("Siz kuryer emassiz yoki hisobingiz faol emas", show_alert=True)
        return

    name = courier.get("name") or callback.from_user.first_name
    uid = courier["uid"]

    if action == "take":
        # Atomar band qilish: bir buyurtma bir necha chatga yuborilgan
        # bo'lishi mumkin, ikki kuryer bir vaqtda bosishi ham mumkin.
        outcome, order = db.claim_order_for_courier(order_id, uid, name)

        if outcome == "not_found":
            await callback.answer("Buyurtma topilmadi", show_alert=True)
            return
        if outcome == "taken":
            await callback.answer(
                f"Bu buyurtmani {order.get('courierName') or 'boshqa kuryer'} oldi",
                show_alert=True,
            )
            await refresh_dispatch(order_id, order, "taken_by_other")
            return
        if outcome == "already":
            # Boshqa chatdagi eskirgan tugmani bosdi — hech narsa
            # o'zgarmaydi, mijozga takroriy xabar ham ketmaydi.
            await callback.answer("Siz bu buyurtmani allaqachon olgansiz")
            await refresh_dispatch(order_id, order, "taken", taker_chat=callback.message.chat.id)
            return

        await callback.answer("Qabul qilindi — yo'lga chiqing 🛵")
        await notify_customer_status(order, "Yetkazilmoqda", order_id)
        await refresh_dispatch(order_id, order, "taken", taker_chat=callback.message.chat.id,
                               courier_name=name)
        return

    if action == "done":
        outcome, order = db.complete_order_by_courier(order_id, uid, name)

        if outcome == "not_found":
            await callback.answer("Buyurtma topilmadi", show_alert=True)
            return
        if outcome == "not_yours":
            await callback.answer("Bu buyurtma sizga biriktirilmagan", show_alert=True)
            return
        if outcome == "already":
            await callback.answer("Bu buyurtma allaqachon yetkazilgan")
            await refresh_dispatch(order_id, order, "done")
            return

        await callback.answer("Yetkazildi ✅ Rahmat!")
        await notify_customer_status(order, "Yetkazildi", order_id)
        await ask_rating(order_id, order)
        await refresh_dispatch(order_id, order, "done", courier_name=name)
        return


@dp.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery):
    """Faqat holatni ko'rsatuvchi tugma — bosilganda hech narsa qilmaydi."""
    await callback.answer()


def route_button(order: dict):
    """
    Marshrut havolasi — Google Maps'ni YO'NALISH rejimida ochadi.

    `dir/?api=1&destination=` telefonda ilovani ishga tushirib
    navigatsiyani boshlaydi; oddiy `?q=` esa faqat nuqtani ko'rsatadi.
    """
    loc = (order or {}).get("customer", {}).get("location") or {}
    lat, lng = loc.get("lat"), loc.get("lng")
    if lat is None or lng is None:
        return None
    return InlineKeyboardButton(
        text="🗺 Manzilga yo'l olish",
        url=f"https://www.google.com/maps/dir/?api=1&destination={lat},{lng}",
    )


async def refresh_dispatch(order_id: str, order: dict, stage: str,
                           taker_chat=None, courier_name: str | None = None):
    """
    Buyurtma yuborilgan BARCHA chatlardagi xabarni yangilaydi.

    Buyurtma bir necha joyga tushishi mumkin (kuryerlarning shaxsiy
    chatlari yoki umumiy guruh). Faqat bosilgan xabarni yangilash
    yetarli emas: qolgan nusxalarda «Oldim» tugmasi eskirib turaverardi.

    Matnga ham «kim biriktirildi» qatori qo'shiladi — ayniqsa guruhda
    muhim: u yerda bir necha kuryer turadi va kim olganini ko'rishi kerak.
    Asl matn /api/orders tomonidan `dispatchText` ga yozib qo'yilgan.
    """
    messages = order.get("dispatchMessages") or []
    base_text = order.get("dispatchText") or ""
    who = courier_name or order.get("courierName") or "Kuryer"

    if stage == "done":
        suffix = f"\n\n✅ <b>{who} yetkazdi</b>"
    else:
        suffix = f"\n\n🛵 <b>{who} bu buyurtmaga biriktirildi</b>"

    for item in messages:
        chat_id = item.get("chatId")
        message_id = item.get("messageId")
        if not chat_id or not message_id:
            continue

        is_taker = taker_chat is not None and str(chat_id) == str(taker_chat)

        if stage == "done":
            rows = [[InlineKeyboardButton(text="✅ Yetkazildi", callback_data="noop")]]
        elif is_taker:
            # Olgan kuryer: keyingi qadam va marshrut
            rows = [[InlineKeyboardButton(
                text="📦 Yetkazdim", callback_data=f"crr:done:{order_id}"
            )]]
            route = route_button(order)
            if route:
                rows.append([route])
        else:
            rows = [[InlineKeyboardButton(text=f"🛵 {who} oldi", callback_data="noop")]]

        markup = InlineKeyboardMarkup(inline_keyboard=rows)

        try:
            if base_text:
                await bot.edit_message_text(
                    base_text + suffix,
                    chat_id=chat_id,
                    message_id=message_id,
                    reply_markup=markup,
                )
            else:
                # Eski buyurtmalarda matn saqlanmagan — hech bo'lmasa
                # tugmani yangilaymiz
                await bot.edit_message_reply_markup(
                    chat_id=chat_id, message_id=message_id, reply_markup=markup,
                )
        except Exception as e:
            # Xabar o'chirilgan yoki o'zgarmagan bo'lishi mumkin — muhim emas
            logger.debug(f"[COURIER] {chat_id}/{message_id} yangilanmadi: {e}")


async def notify_customer_status(order: dict, status: str, order_id: str | None = None):
    """Mijozga holat o'zgargani haqida xabar va bildirishnoma."""
    user_id = order.get("userId")
    if not user_id:
        return

    label = db.order_display_id(order)
    texts = {
        "Yetkazilmoqda": f"🚚 <b>{label}</b> buyurtmangiz yo'lga chiqdi. Kuryer tez orada bog'lanadi.",
        "Yetkazildi": f"🎉 <b>{label}</b> buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!",
    }
    try:
        db.send_notification(user_id, "Buyurtma holati", f"{label} — {status}", "order", order_id)
        await bot.send_message(user_id, texts.get(status, f"{label} — {status}"))
    except Exception as e:
        logger.warning(f"[COURIER] Mijozga xabar bormadi: {e}")


@dp.callback_query(F.data.startswith("os:"))
async def cb_order_status(callback: CallbackQuery):
    """
    Eski xabarlardagi holat tugmalari.

    Holat endi veb admin paneldan o'zgartiriladi. Tugmalar eski
    xabarlarda qolib ketgan — bosilganda jim turmasin, tushuntirib
    qo'yamiz.
    """
    await callback.answer(
        "Holat endi admin paneldan o'zgartiriladi",
        show_alert=True,
    )


# ─── Chek yuborish ────────────────────────────────────────────

@dp.callback_query(F.data.startswith("receipt:"))
async def cb_start_receipt(callback: CallbackQuery, state: FSMContext):
    order_id = callback.data.split("receipt:", 1)[-1]
    await state.update_data(receipt_order_id=order_id)
    await state.set_state(PaymentUpload.waiting_photo)
    await callback.message.answer(
        "📸 <b>To'lov chekini yuboring</b>\n\n"
        "Pul o'tkazilganini tasdiqlovchi <b>screenshot yoki rasmni</b> yuboring:"
    )
    await callback.answer()


@dp.message(PaymentUpload.waiting_photo, F.photo)
async def handle_receipt_photo(message: Message, state: FSMContext):
    data     = await state.get_data()
    order_id = data.get("receipt_order_id", "—")
    user_id  = message.from_user.id

    order   = db.get_order_by_id(order_id) if order_id != "—" else None
    display_id = db.order_display_id(order) if order else order_id
    caption = build_receipt_caption(order, display_id)

    try:
        for admin_id in all_admins():
            try:
                await bot.send_photo(admin_id,
                                     photo=message.photo[-1].file_id,
                                     caption=caption,
                                     reply_markup=payment_confirm_kb(
                                         order_id, user_id, order_has_location(order)))
            except Exception as e:
                logger.warning(f"[RECEIPT] Admin {admin_id} ga yuborib bo'lmadi: {e}")
        logger.info(f"[RECEIPT] Adminga yo'naltirildi: {order_id} ← {user_id}")
    except Exception as e:
        logger.error(f"[RECEIPT] Adminga yuborib bo'lmadi: {e}")

    await state.clear()
    await message.answer(
        "✅ <b>Chekingiz yuborildi!</b>\n\n"
        "Admin tekshirib, tez orada xabar beramiz 📬"
    )


@dp.message(PaymentUpload.waiting_photo)
async def handle_receipt_wrong(message: Message):
    await message.answer("❌ Iltimos, to'lov chekini <b>rasm (foto)</b> sifatida yuboring.")


# ─── Admin: To'lovni tasdiqlash / rad etish ──────────────────

@dp.callback_query(F.data.startswith("pconf:"))
async def cb_payment_confirm(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        await callback.answer("Sizda ruxsat yo'q", show_alert=True)
        return

    parts    = callback.data.split(":")
    action   = parts[1]        # ok | no
    order_id = parts[2]        # Firestore hujjat id'si
    user_id  = int(parts[3])

    order      = db.get_order_by_id(order_id)
    display_id = db.order_display_id(order) if order else order_id

    # Ikkinchi admin ham xuddi shu chekni olgan bo'ladi. U kechroq
    # tugma bossa, mijozga takroriy xabar ketmasligi kerak.
    current = (order or {}).get("paymentStatus")
    if current in ("Tolangan", "Rad etildi"):
        already = "tasdiqlangan" if current == "Tolangan" else "rad etilgan"
        try:
            await callback.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        await callback.answer(f"Bu chek allaqachon {already}", show_alert=True)
        return

    approved = action == "ok"
    db.update_payment_status(order_id, "Tolangan" if approved else "Rad etildi")
    logger.info(f"[PAY] {'Tasdiqlandi' if approved else 'Rad etildi'}: {order_id}")

    # ── Mijozga xabar (bitta, faqat bir marta) ──
    try:
        if approved:
            u_text  = "✅ <b>To'lovingiz tasdiqlandi!</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"🧾 Buyurtma: <b>{display_id}</b>\n"
            u_text += "💰 To'lov qabul qilindi! Tez orada yetkaziladi 🚀"
            await bot.send_message(user_id, u_text, reply_markup=mini_app_kb())
        else:
            u_text  = "❌ <b>To'lov cheki rad etildi</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"🧾 Buyurtma: <b>{display_id}</b>\n"
            u_text += "Iltimos, to'g'ri chekni qayta yuboring."
            await bot.send_message(user_id, u_text, reply_markup=resend_receipt_kb(order_id))
    except Exception as e:
        logger.warning(f"[PAY] Mijozga xabar yuborilmadi: {e}")

    # ── Chek xabarini SHU YERNING O'ZIDA yangilaymiz ──
    # Ilgari bu yerda har bir adminga alohida "statusni o'zgartiring"
    # xabari yuborilardi. Natijada tasdiqlashdan keyin ortiqcha xabarlar
    # to'planib qolardi, holbuki status tugmalari shu xabarga sig'adi.
    mark = "✅ <b>TO'LOV TASDIQLANDI</b>" if approved else "❌ <b>CHEK RAD ETILDI</b>"
    hint = "Endi buyurtma holatini belgilang 👇" if approved else "Mijoz yangi chek yuborishi kutilmoqda."
    try:
        await callback.message.edit_caption(
            caption=current_caption(callback.message) + f"\n\n{mark}\n{hint}",
            reply_markup=order_action_kb(order_id, order_has_location(order)) if approved else None,
        )
    except Exception as e:
        logger.warning(f"[PAY] Chek xabarini yangilab bo'lmadi: {e}")

    await callback.answer("✅ Tasdiqlandi" if approved else "❌ Rad etildi")


# ─── Lokatsiyani yuborish ────────────────────────────────────

@dp.callback_query(F.data.startswith("loc:"))
async def cb_send_location(callback: CallbackQuery):
    """
    Mijoz manzilini haqiqiy Telegram lokatsiyasi sifatida yuboradi.

    Havola emas, venue xabari — uni kuryerga oddiy forward qilish
    mumkin va u xaritada ochiladi.
    """
    if not is_admin(callback.from_user.id):
        await callback.answer("Sizda ruxsat yo'q", show_alert=True)
        return

    order_id = callback.data[len("loc:"):]
    order = db.get_order_by_id(order_id)

    if not order:
        await callback.answer("Buyurtma topilmadi", show_alert=True)
        return

    customer = order.get("customer", {})
    loc = customer.get("location") or {}
    lat, lng = loc.get("lat"), loc.get("lng")

    if lat is None or lng is None:
        await callback.answer("Bu buyurtmada lokatsiya yo'q", show_alert=True)
        return

    display_id = db.order_display_id(order)
    title = f"{customer.get('name') or 'Mijoz'} — {display_id}"
    address = customer.get("address") or "Manzil ko'rsatilmagan"

    try:
        # send_venue — pin + nom + manzil. Forward qilinadi, xaritada ochiladi.
        await bot.send_venue(
            callback.from_user.id,
            latitude=float(lat),
            longitude=float(lng),
            title=title[:255],
            address=address[:255],
        )
        await callback.answer("Lokatsiya yuborildi")
        logger.info(f"[LOC] {display_id} -> {callback.from_user.id}")
    except Exception as e:
        logger.error(f"[LOC] yuborilmadi: {e}")
        await callback.answer("Lokatsiyani yuborib bo'lmadi", show_alert=True)


# ─── Buyurtmalarim ─────────────────────────────
#
# Buyurtmalar botda KO'RSATILMAYDI — faqat ilovada.
#
# Ilgari bot har bir buyurtmani to'liq matn bilan chiqarardi:
# mahsulotlar, holat, summa. Bir necha buyurtma bo'lsa xabar juda
# uzun bo'lib ketardi, holat esa o'zgarganda xabardagi matn eski
# holida qolib ketardi. Ilovada holat real vaqtda yangilanadi.


def my_orders_kb() -> InlineKeyboardMarkup:
    """Ilovaning «Buyurtmalarim» bo'limini bevosita ochadi."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="📦 Buyurtmalarimni ochish",
            web_app=WebAppInfo(url=f"{MINI_APP_URL}?page=orders"),
        )]
    ])


@dp.message(F.text == "📦 Buyurtmalarim")
async def handle_my_orders(message: Message):
    orders = db.get_user_orders(message.from_user.id)

    if not orders:
        await message.answer(
            "📦 <b>Buyurtmalarim</b>\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "Sizda hozircha buyurtma yo'q.\n\n"
            "🥟 Yarim tayyor mahsulotlar, 🍦 muzqaymoq va 🍫 siroklar.\n"
            "Katalogdan tanlab, birinchi buyurtmangizni bering!",
            reply_markup=my_orders_kb(),
        )
        return

    CLOSED = ("Yetkazildi", "Bekor qilingan", "Rad etildi")
    active = [o for o in orders if o.get("status") not in CLOSED]

    text = (
        "📦 <b>Buyurtmalarim</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🧾 Jami buyurtma: <b>{len(orders)} ta</b>\n"
        f"🔄 Jarayonda: <b>{len(active)} ta</b>\n\n"
        "Har bir buyurtmaning holati, tarkibi va yetkazish manzili —\n"
        "hammasi ilovada. Holat <b>real vaqtda</b> yangilanadi:\n\n"
        "✅ Qabul qilindi → 🚚 Yetkazilmoqda → 🎉 Yetkazildi\n\n"
        "👇 <i>Ko'rish uchun tugmani bosing:</i>"
    )

    rows = list(my_orders_kb().inline_keyboard)

    # Chek yuborish ilovada EMAS, botda bo'lishi kerak: mijoz rasm
    # jo'natadi. Shuning uchun karta to'lovi kutilayotgan
    # buyurtmalar uchun tugma shu yerda qoladi.
    for o in orders[:5]:
        if o.get("paymentMethod") != "Karta":
            continue
        pay = o.get("paymentStatus", "")
        if pay == "Tolangan":
            continue
        doc_id = o.get("_doc_id", "")
        if not doc_id:
            continue
        label = "qayta chek" if pay == "Rad etildi" else "chek yuborish"
        rows.append([InlineKeyboardButton(
            text=f"💳 {db.order_display_id(o)} — {label}",
            callback_data=f"receipt:{doc_id}",
        )])

    await message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


# ─── /start ──────────────────────────────────────────────────

@dp.message(F.text.startswith("/start"))
async def cmd_start(message: Message, state: FSMContext):
    user     = message.from_user
    # Panelga kira oladiganlar: adminlar va paneldagi owner/admin xodimlar
    admin = can_open_panel(user.id)

    # ── Deep link: /start receipt_<hujjat_id> ──
    # Yangi havolalar Firestore hujjat id'sini yuboradi. Eski havolalarda
    # "#" siz raqam kelardi — u ham ishlashda davom etadi (F-03).
    parts = message.text.split(" ", 1)
    if len(parts) > 1 and parts[1].startswith("receipt_"):
        raw_id = parts[1].replace("receipt_", "").strip()

        order = db.get_order_by_id(raw_id) or db.get_order_by_id(f"#{raw_id}")
        if order:
            order_id   = order.get("_doc_id", raw_id)
            display_id = db.order_display_id(order)
            products  = order.get("products", [])
            total     = order.get("total", 0)
            total_str = db.format_price(total) if isinstance(total, (int, float)) else str(total)

            await state.update_data(receipt_order_id=order_id)
            await state.set_state(PaymentUpload.waiting_photo)

            u_text  = "💳 <b>To'lov ma'lumotlari</b>\n"
            u_text += "━" * 22 + "\n\n"
            u_text += f"🆔 Buyurtma ID: <b>{display_id}</b>\n"
            u_text += "📦 <b>Mahsulotlar:</b>\n"
            for p in products:
                qty   = p.get("quantity", 1)
                size  = p.get("size")
                color = p.get("color")
                prod  = p.get("product") or p
                name  = prod.get("name", "—")
                
                variant_info = []
                if size: variant_info.append(f"Vazn: {size}")
                if color: variant_info.append(f"Turi: {color}")
                var_text = f" ({', '.join(variant_info)})" if variant_info else ""
                
                u_text += f"  • {name}{var_text} × {qty}\n"
            u_text += f"\n💰 Jami: <b>{total_str}</b>\n"
            u_text += "━" * 22 + "\n\n"
            pay_cfg = db.get_payment_settings()
            u_text += "💳 <b>Karta raqami:</b>\n"
            u_text += f"<code>{pay_cfg['cardNumber']}</code>\n"
            u_text += f"👤 Egasi: <b>{pay_cfg['cardOwner']}</b>\n\n"
            u_text += "📸 Pul o'tkazgandan so'ng <b>to'lov chekini (screenshot)</b> yuboring:"
            await message.answer(u_text, reply_markup=main_kb(admin))
        else:
            await message.answer(
                "❌ Buyurtma topilmadi.\n"
                "Iltimos, mini appdagi «To'lov chekini yuborish» tugmasini qayta bosing.",
                reply_markup=main_kb(admin)
            )
        return

    # ── Oddiy /start ──
    text = (
        f"Assalomu alaykum, <b>{user.first_name}</b>! 👋\n\n"
        "🥟 <b>MUSA rasmiy do'koniga xush kelibsiz!</b>\n"
        "<i>Muzlatilgan mahsulotlar — yangi xomashyo, shok muzlatish.</i>\n\n"
        "🍽 <b>Yarim tayyor mahsulotlar, muzqaymoq va siroklar.</b>\n\n"
        "👇 <i>Buyurtmani boshlash uchun quyidagi tugmani bosing:</i>"
    )
    await message.answer(text, reply_markup=main_kb(admin))

    # Adminlarga panelga kirish tugmasi — mijozlarda bu xabar bo'lmaydi
    if admin:
        await message.answer(PANEL_TEXT, reply_markup=panel_kb())

    # Telefon raqami hali saqlanmagan bo'lsa, bir bosishda so'raymiz.
    # Mini app buni buyurtma formasiga avtomatik qo'yadi (F-26).
    saved = db.get_user(user.id) or {}
    if not saved.get("phone"):
        await message.answer(
            "📱 <b>Telefon raqamingizni qoldiring</b>\n\n"
            "Buyurtma berganingizda uni qayta yozib o'tirmaysiz, "
            "kuryer esa siz bilan tez bog'lana oladi.\n\n"
            "<i>Ixtiyoriy — keyinroq ilovaning «Shaxsiy ma'lumotlar» "
            "bo'limidan ham kiritish mumkin.</i>",
            reply_markup=contact_kb(),
        )


@dp.message(F.contact)
async def handle_contact(message: Message):
    """Foydalanuvchi «Raqamni yuborish» tugmasini bosganda (F-26)."""
    contact = message.contact

    # Faqat o'z raqamini qabul qilamiz — boshqa odamning kontaktini emas
    if contact.user_id != message.from_user.id:
        await message.answer(
            "❌ Iltimos, <b>o'zingizning</b> raqamingizni yuboring.",
            reply_markup=contact_kb(),
        )
        return

    admin = can_open_panel(message.from_user.id)
    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = f"+{phone}"

    if db.set_user_phone(message.from_user.id, phone):
        await message.answer(
            f"✅ Raqamingiz saqlandi: <code>{phone}</code>\n\n"
            "Endi buyurtma berishda u avtomatik to'ldiriladi.",
            reply_markup=main_kb(admin),
        )
    else:
        await message.answer(
            "❌ Raqamni saqlab bo'lmadi. Keyinroq qayta urinib ko'ring.",
            reply_markup=main_kb(admin),
        )


@dp.message(F.text == "🥟 Katalogni ochish")
async def handle_open_catalog(message: Message):
    """
    Katalog tugmasi bosilganda do'konni ochadigan tugmani yuboradi.

    Reply-klaviatura tugmasining o'ziga `web_app` biriktirilmagan:
    u yozuv maydoni yonidagi doimiy menyu tugmasi bilan birga turadi
    va matn sifatida ham ishlashi kerak. Shuning uchun javob
    sifatida inline tugma beriladi — bir bosishda do'kon ochiladi.
    """
    text = "🥟 <b>MUSA KATALOGI</b>\n"
    text += "━" * 22 + "\n\n"
    text += "Yarim tayyor mahsulotlar, muzqaymoq va siroklar — hammasi bir joyda.\n\n"
    text += "👇 <b>Katalogni ochish</b> tugmasini bosing — do'kon shu yerning o'zida ochiladi."

    await message.answer(text, reply_markup=catalog_kb())


@dp.message(F.text == "📞 Biz bilan aloqa")
async def cmd_contact(message: Message):
    await message.answer(
        "📞 <b>MUSA bilan bog'lanish:</b>\n\n"
        f"💬 <b>Mijozlar xizmati:</b> {SUPPORT_TELEGRAM}\n"
        f"📞 <b>Telefon raqam:</b> {SUPPORT_PHONE}\n"
        f"✉️ <b>Email:</b> {SUPPORT_EMAIL}\n"
        f"📍 <b>Manzil:</b> {COMPANY_CITY}\n"
        f"⏰ <b>Ish vaqti:</b> {WORK_HOURS}\n\n"
        "<i>Ulgurji xarid va hamkorlik bo'yicha ham shu raqamga murojaat qiling.</i>"
    )


# ─── Baho: yetkazilgandan keyin ──────────────────────────────
#
# Buyurtma «Yetkazildi» bo'lganda mijozga BITTA baho so'rovi keladi
# (admin panel yoki kuryer — qaysi yo'l bilan bo'lmasin). Bosilgan baho
# buyurtmadagi HAMMA mahsulotga qo'yiladi.
#
# Ilgari har mahsulot alohida so'ralardi: besh mahsulotli buyurtmada
# mijoz besh marta bosishi kerak edi va ko'pchilik yarim yo'lda tashlab
# ketardi. Matn api/_lib/actions/orders.ts dagi sendRatingPrompt bilan bir xil.

def rating_prompt(order_id: str, order: dict):
    items = db.order_review_items(order)
    if not items:
        return None, None
    label = db.order_display_id(order)
    scope = (
        f"Bitta baho — buyurtmadagi {len(items)} ta mahsulotning hammasiga qo'yiladi.\n\n"
        if len(items) > 1 else ""
    )
    text = (
        f"⭐ <b>{label} buyurtmangiz qanday bo'ldi?</b>\n\n"
        f"{scope}"
        "<i>Bahoingiz ilovada boshqa xaridorlarga yordam beradi.</i>"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"{n}⭐", callback_data=f"rv:{order_id}:all:{n}") for n in range(1, 6)],
        [InlineKeyboardButton(text="O'tkazib yuborish", callback_data=f"rv:{order_id}:all:0")],
    ])
    return text, kb


async def ask_rating(order_id: str, order: dict):
    """Kuryer «Yetkazdim» bosganda — baho so'rovi mijozga."""
    user_id = (order or {}).get("userId")
    if not user_id:
        return
    text, kb = rating_prompt(order_id, order)
    if not text:
        return
    try:
        await bot.send_message(user_id, text, reply_markup=kb)
    except Exception as e:
        logger.warning(f"[REVIEW] baho so'rovi yetmadi: {e}")


@dp.callback_query(F.data.startswith("rv:"))
async def cb_review(callback: CallbackQuery):
    # Uchinchi bo'lak — eski xabarlarda mahsulot tartibi, endi «all».
    # E'tiborga olinmaydi: baho baribir hamma mahsulotga qo'yiladi.
    try:
        _, order_id, _slot, stars = callback.data.split(":", 3)
        stars = int(stars)
    except ValueError:
        await callback.answer()
        return
    if not 0 <= stars <= 5:
        await callback.answer()
        return

    if stars == 0:
        await callback.answer("O'tkazib yuborildi")
        done = (
            "Baho qoldirmadingiz — zarari yo'q.\n"
            "Xohlasangiz, keyinroq ilovadagi mahsulot sahifasidan baholashingiz mumkin."
        )
    else:
        outcome, saved = db.save_bot_review_all(order_id, callback.from_user.id, stars)
        if outcome == "not_yours":
            await callback.answer("Bu buyurtma sizniki emas", show_alert=True)
            return
        if outcome != "saved":
            await callback.answer("Baho saqlanmadi — ilovada qoldirishingiz mumkin", show_alert=True)
            return
        await callback.answer(f"Rahmat! {'⭐' * stars}")
        count = f"{saved} ta mahsulotga" if saved > 1 else "Mahsulotga"
        done = (
            f"{count} <b>{'⭐' * stars}</b> qo'yildi.\n"
            "Baholaringiz mahsulot sahifasida ko'rinadi va boshqa xaridorlarga yordam beradi."
        )

    try:
        await callback.message.edit_text(
            f"💚 <b>Rahmat!</b>\n\n{done}",
            reply_markup=my_orders_kb(),
        )
    except Exception as e:
        logger.debug(f"[REVIEW] xabar yangilanmadi: {e}")


# ─── Admin: /panel ─────────────────────────────

@dp.message(Command("panel"))
async def cmd_panel(message: Message):
    """Admin panelni ochish tugmasini yuboradi (faqat adminlarga)."""
    if not can_open_panel(message.from_user.id):
        await message.answer("🛠 Bu buyruq faqat <b>adminlar</b> uchun.")
        return
    await message.answer(PANEL_TEXT, reply_markup=panel_kb())


@dp.message(F.text == PANEL_BUTTON)
async def handle_panel_button(message: Message):
    """
    Tugma matni kelib qolsa (eski mijozda `web_app` ishlamasa) —
    inline tugma bilan javob beramiz, admin baribir panelga kiradi.
    """
    if not can_open_panel(message.from_user.id):
        return
    await message.answer(PANEL_TEXT, reply_markup=panel_kb())


# ─── Kuryer: /bugun ──────────────────────────────────────────

@dp.message(Command("bugun"))
async def cmd_today(message: Message):
    """
    Kuryerning bugungi ishi: nechta yetkazdi, nechtasi yo'lda va
    qo'lida qancha naqd pul bo'lishi kerak (kassaga topshirish uchun).
    """
    courier = db.get_courier_by_telegram(message.from_user.id)
    if not courier:
        await message.answer("🛵 Bu buyruq faqat <b>kuryerlar</b> uchun.")
        return

    r = db.courier_today(courier["uid"])
    months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun",
              "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
    day = f"{r['date'].day}-{months[r['date'].month - 1]}"
    name = courier.get("name") or message.from_user.first_name

    lines = [
        f"🛵 <b>{name} — bugun, {day}</b>",
        "━" * 22,
        "",
        f"✅ Yetkazildi: <b>{len(r['delivered'])} ta</b>",
        f"🚚 Yo'lda: <b>{len(r['on_way'])} ta</b>",
        f"⏳ Olib ketish kutilmoqda: <b>{len(r['waiting'])} ta</b>",
        "",
        f"💵 Naqd pul (kassaga topshiriladi): <b>{db.format_price(r['cash'])}</b>",
        f"💳 Karta orqali to'langan: <b>{db.format_price(r['card'])}</b>",
    ]

    if r["delivered"]:
        lines += ["", "<b>Yetkazilganlar:</b>"]
        for o in r["delivered"][-15:]:
            pay = "💳" if o.get("paymentMethod") == "Karta" else "💵"
            lines.append(f"{o['_at']:%H:%M} · {db.order_display_id(o)} · {db.format_price(o.get('total') or 0)} {pay}")
        if len(r["delivered"]) > 15:
            lines.append(f"<i>… va yana {len(r['delivered']) - 15} ta</i>")

    if r["on_way"]:
        lines += ["", "<b>Hozir yo'lda:</b>"]
        for o in r["on_way"][:10]:
            address = (o.get("customer") or {}).get("address") or "—"
            lines.append(f"{db.order_display_id(o)} · {address[:40]}")

    if not (r["delivered"] or r["on_way"] or r["waiting"]):
        lines += ["", "<i>Bugun hali buyurtma yo'q. Omad! 🍀</i>"]

    await message.answer("\n".join(lines))


@dp.message(Command("group"))
async def cmd_group(message: Message):
    """
    Guruh identifikatorini aytadi.

    Admin panelda «Umumiy guruhga yuborish» uchun chat ID kerak. Uni
    qo'lda topish noqulay (manfiy raqam, oson xato qilinadi), shuning
    uchun botning o'zi aytadi: guruhga qo'shib, /group deb yozish kifoya.
    """
    chat = message.chat
    if chat.type == "private":
        await message.answer(
            "ℹ️ Bu buyruq <b>guruhda</b> ishlaydi.\n\n"
            "1️⃣ Botni guruhga qo'shing\n"
            "2️⃣ Uni admin qiling\n"
            "3️⃣ Guruhda <code>/group</code> deb yozing\n\n"
            "Bot guruh ID sini beradi — uni admin panel → Sozlamalar →\n"
            "«Umumiy guruhga» maydoniga qo'yasiz."
        )
        return

    await message.answer(
        f"🆔 <b>Guruh ID si:</b>\n\n<code>{chat.id}</code>\n\n"
        f"Nomi: {chat.title}\n\n"
        "Shu raqamni admin panel → Sozlamalar → «Umumiy guruhga» "
        "maydoniga nusxalang."
    )


@dp.message(F.text.in_({"ℹ️ Yordam", "/help"}))
async def cmd_help(message: Message):
    await message.answer(
        "ℹ️ <b>Botdan qanday foydalanish mumkin?</b>\n\n"
        "1️⃣ Yozuv maydoni yonidagi <b>«🥟 Katalog»</b> tugmasini bosib, "
        "MUSA mahsulotlari bilan tanishing.\n"
        "2️⃣ O'zingizga yoqqan mahsulotlarni <b>Savatga</b> qo'shing.\n"
        "3️⃣ Buyurtmani rasmiylashtirishda <b>Naqd</b> yoki <b>Karta</b> orqali to'lov usulini tanlang.\n"
        "4️⃣ Agar karta orqali to'lov qilsangiz, to'lov chekini botga yuboring.\n"
        "5️⃣ Buyurtmangiz holatini <b>Buyurtmalarim</b> bo'limidan kuzatib boring.\n\n"
        "<i>Qo'shimcha savollar uchun <b>'📞 Biz bilan aloqa'</b> bo'limiga murojaat qiling.</i>"
    )


# ─── WebApp sendData (fallback) ───────────────────────────────

@dp.message(F.web_app_data)
async def handle_webapp_data(message: Message):
    try:
        data       = json.loads(message.web_app_data.data)
        pay_method = data.get("paymentMethod", "Naqd")
        order_id   = data.get("id", "")
        # Xabarnomani /api/orders yuborgan — bu yerda takrorlamaymiz
        if pay_method == "Naqd":
            await message.answer(
                f"🎉 <b>Buyurtmangiz qabul qilindi!</b>\n"
                f"🆔 Buyurtma: <b>{order_id}</b>\n"
                "💵 To'lov: Naqd (yetkazganda)\n\n"
                "Operatorimiz tez orada bog'lanadi 📞"
            )
    except Exception as e:
        logger.error(f"WebApp data: {e}")
        await message.answer("❌ Xatolik. Qayta urinib ko'ring.")


# ─── Main ─────────────────────────────────────────────────────

async def main():
    # Sozlama hujjatlari hali yo'q bo'lsa, boshlang'ich qiymatlar bilan yaratamiz
    db.ensure_payment_settings()
    db.ensure_delivery_settings()
    db.ensure_main_categories()

    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="🥟 Katalog", web_app=WebAppInfo(url=MINI_APP_URL))
        )
    except Exception as e:
        logger.warning(f"Menu button: {e}")

    loop = asyncio.get_running_loop()

    # Yangi buyurtma xabarnomasi bu yerda EMAS — uni /api/orders yuboradi
    # (api/_lib/actions/orders.ts → notifyNewOrder). Sababi: bot shaxsiy
    # kompyuterda ishlaydi va o'chiq bo'lishi mumkin, Vercel esa doim yoqiq.
    # Bekor qilish xabari hozircha shu yerda qoladi.
    def on_order_cancelled(order_data):
        asyncio.run_coroutine_threadsafe(notify_admin_cancel(order_data), loop)

    watch = db.listen_to_new_orders(None, on_order_cancelled)
    logger.info("[BOT] Ishga tushdi ✅")

    try:
        await dp.start_polling(bot)
    finally:
        watch.unsubscribe()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
