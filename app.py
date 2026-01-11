# -*- coding: utf-8 -*-
"""
แอปพลิเคชันหลักสำหรับระบบคำนวณคอมมิชชั่น ATMO'decor - Version 2.0
"""

import os
import re
from datetime import datetime
from flask import Flask, request, abort
from linebot import WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import (
    MessageEvent,
    TextMessage,
    ImageMessage,
    PostbackEvent
)
from dotenv import load_dotenv

from src.database import SalesDatabase
from src.line_handler import LineHandler
from src import commission_calculator

# โหลด environment variables
load_dotenv()

# สร้าง Flask app
app = Flask(__name__)

# ตั้งค่า LINE
CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET')

if not CHANNEL_ACCESS_TOKEN or not CHANNEL_SECRET:
    raise ValueError("กรุณาตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_CHANNEL_SECRET ใน .env")

# สร้าง instances
db = SalesDatabase()
line_handler = LineHandler(CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET)
handler = line_handler.handler


@app.route("/webhook", methods=['POST'])
def webhook():
    """Webhook endpoint สำหรับรับข้อความจาก LINE"""
    signature = request.headers['X-Line-Signature']
    body = request.get_data(as_text=True)
    
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)
    
    return 'OK'


@handler.add(MessageEvent, message=TextMessage)
def handle_text_message(event):
    """จัดการข้อความที่เป็นข้อความ"""
    user_id = event.source.user_id
    text = event.message.text.strip()
    reply_token = event.reply_token
    
    # ตรวจสอบคำสั่ง
    if text.startswith('/'):
        handle_command(event, text)
        return
    
    # ตรวจสอบสถานะผู้ใช้
    user_state = line_handler.get_user_state(user_id)
    state = user_state.get("state", "idle")
    
    if state == "waiting_date":
        # รอวันที่ (ไม่ควรเกิดกรณีนี้ เพราะใช้ Date Picker)
        line_handler.send_message(reply_token, "กรุณาเลือกวันที่จากปุ่มด้านบน")
        return
    
    elif state == "waiting_staff_count":
        # รอจำนวนคนตอบ
        try:
            staff_count = int(text)
            if staff_count <= 0:
                raise ValueError()
            
            # บันทึกจำนวนคน
            line_handler.set_user_state(user_id, "waiting_staff_names", {
                "date": user_state.get("date"),
                "staff_count": staff_count
            })
            
            # ถามชื่อผู้ตอบ
            line_handler.send_staff_names_question(reply_token)
        except:
            line_handler.send_message(reply_token, "กรุณาระบุจำนวนคนเป็นตัวเลข เช่น 2")
        return
    
    elif state == "waiting_staff_names":
        # รอชื่อผู้ตอบ
        staff_names = [name.strip() for name in text.split(',')]
        staff_count = user_state.get("staff_count", len(staff_names))
        date = user_state.get("date")
        
        # เริ่มต้นวัน
        db.start_day(date, staff_count, staff_names)
        
        # ล้างสถานะ
        line_handler.clear_user_state(user_id)
        
        # ส่งข้อความยืนยัน
        message = f"""✅ เริ่มต้นวันสำเร็จ!

📅 วันที่: {date}
👥 จำนวนคน: {staff_count} คน
📝 ชื่อ: {', '.join(staff_names)}

พร้อมรับออเดอร์แล้ว! 🚀"""
        line_handler.send_message(reply_token, message)
        return
    
    # ถ้าไม่ได้อยู่ในโฟลว์พิเศษ ให้ประมวลผลเป็นออเดอร์
    if not db.is_day_started():
        line_handler.send_message(reply_token, "กรุณาเริ่มต้นวันก่อน โดยส่งคำสั่ง /start")
        return
    
    # ดึงข้อมูลจากข้อความ
    process_order_text(event, text)


@handler.add(MessageEvent, message=ImageMessage)
def handle_image_message(event):
    """จัดการข้อความที่เป็นรูปภาพ"""
    if not db.is_day_started():
        line_handler.send_message(event.reply_token, "กรุณาเริ่มต้นวันก่อน โดยส่งคำสั่ง /start")
        return
    
    # ดาวน์โหลดรูปภาพ
    message_id = event.message.id
    image_data = line_handler.download_image(message_id)
    
    # บันทึกรูปภาพ (จะได้ order_id หลังจากประมวลผลข้อความ)
    # ในกรณีนี้ เราจะเก็บ image_data ไว้ใน user_state ก่อน
    user_id = event.source.user_id
    user_state = line_handler.get_user_state(user_id)
    user_state["pending_image"] = image_data
    line_handler.set_user_state(user_id, user_state.get("state", "idle"), user_state)
    
    line_handler.send_message(event.reply_token, "📸 รับรูปภาพแล้ว! กรุณาส่งข้อมูลออเดอร์ (ชื่อสินค้า, ยอดเงิน, เวลา)")


@handler.add(PostbackEvent)
def handle_postback(event):
    """จัดการ Postback Event (จาก Date Picker)"""
    user_id = event.source.user_id
    data = event.postback.data
    reply_token = event.reply_token
    
    if data.startswith("action=select_date"):
        # ดึงวันที่จาก postback
        date = event.postback.params.get('date')
        
        if date:
            # บันทึกวันที่และถามจำนวนคน
            line_handler.set_user_state(user_id, "waiting_staff_count", {"date": date})
            line_handler.send_staff_count_question(reply_token)
        else:
            line_handler.send_message(reply_token, "ไม่สามารถดึงวันที่ได้ กรุณาลองใหม่")


def handle_command(event, command: str):
    """จัดการคำสั่งพิเศษ"""
    reply_token = event.reply_token
    user_id = event.source.user_id
    
    if command == "/start":
        # เริ่มต้นวันใหม่
        line_handler.set_user_state(user_id, "waiting_date")
        line_handler.send_start_date_picker(reply_token)
    
    elif command == "/summary":
        # แสดงสรุปยอด
        if not db.is_day_started():
            line_handler.send_message(reply_token, "กรุณาเริ่มต้นวันก่อน โดยส่งคำสั่ง /start")
            return
        
        summary = db.get_summary()
        line_handler.send_summary(reply_token, summary)
    
    elif command == "/images":
        # แสดงรูปภาพทั้งหมด
        if not db.is_day_started():
            line_handler.send_message(reply_token, "กรุณาเริ่มต้นวันก่อน โดยส่งคำสั่ง /start")
            return
        
        image_paths = db.get_order_images()
        line_handler.send_images_gallery(reply_token, image_paths)
    
    elif command == "/reset":
        # รีเซ็ตข้อมูล
        summary = db.get_summary()
        db.reset()
        
        message = f"""🔄 รีเซ็ตข้อมูลสำเร็จ!

สรุปยอดก่อนรีเซ็ต:
• วันที่: {summary.get('date', '')}
• ยอดขายรวม: {summary.get('total_sales', 0):,.0f} บาท
• จำนวนออเดอร์: {summary.get('total_orders', 0)} ออเดอร์
• คอมมิชชั่นรวม: {summary.get('commission_total', 0):,.0f} บาท

ข้อมูลถูกสำรองไว้แล้ว
กรุณาเริ่มต้นวันใหม่ด้วย /start"""
        
        line_handler.send_message(reply_token, message)
    
    elif command == "/help":
        # แสดงความช่วยเหลือ
        line_handler.send_help(reply_token)
    
    else:
        line_handler.send_message(reply_token, f"ไม่รู้จักคำสั่ง {command}\nพิมพ์ /help เพื่อดูคำสั่งที่ใช้ได้")


def process_order_text(event, text: str):
    """ประมวลผลข้อความออเดอร์"""
    reply_token = event.reply_token
    user_id = event.source.user_id
    
    # ดึงข้อมูลจากข้อความ
    lines = text.split('\n')
    
    # บรรทัดแรกคือชื่อสินค้า
    product_name = lines[0].strip() if lines else ""
    
    # ดึงยอดเงิน
    amount = commission_calculator.extract_amount(text)
    
    # ดึงเวลา
    time = commission_calculator.extract_time(text)
    
    if not amount:
        line_handler.send_message(reply_token, "ไม่พบยอดเงินในข้อความ กรุณาระบุยอดเงิน")
        return
    
    if not time:
        # ใช้เวลาปัจจุบัน
        time = datetime.now().strftime("%H:%M")
    
    # ตรวจสอบว่ามีแจกัน 2 ใบขึ้นไปหรือไม่
    is_two_vases = False
    if re.search(r'(\d+)\s*(แจกัน|vase|เวส)', product_name, re.IGNORECASE):
        match = re.search(r'(\d+)\s*(แจกัน|vase|เวส)', product_name, re.IGNORECASE)
        vase_count = int(match.group(1))
        if vase_count >= 2:
            is_two_vases = True
    
    # คำนวณคอมมิชชั่น
    total_sales = db.get_summary().get("total_sales", 0)
    commission_info = commission_calculator.calculate_order_commission(
        amount=amount,
        product_name=product_name,
        total_sales=total_sales + amount,  # ยอดรวมหลังเพิ่มออเดอร์นี้
        is_two_vases=is_two_vases
    )
    
    # ดึงรูปภาพถ้ามี
    user_state = line_handler.get_user_state(user_id)
    image_data = user_state.get("pending_image")
    image_path = None
    
    # บันทึกออเดอร์
    order_id = len(db.get_orders()) + 1
    
    if image_data:
        image_path = db.save_image(image_data, order_id)
        # ล้างรูปภาพที่รอ
        user_state.pop("pending_image", None)
        line_handler.set_user_state(user_id, "idle", user_state)
    
    db.add_order(
        order_id=order_id,
        amount=amount,
        product_name=product_name,
        time=time,
        image_path=image_path,
        note="",
        commission_1=commission_info["commission_1"],
        commission_5=commission_info["commission_5"],
        add_on_2vases=commission_info["add_on_2vases"],
        is_special=commission_info["is_special"],
        count_as_order=commission_info["count_as_order"]
    )
    
    # คำนวณยอดรวมใหม่
    summary = db.get_summary()
    total_orders = summary.get("total_orders", 0)
    
    # คำนวณ Add on (order)
    add_on_order = commission_calculator.calculate_order_bonus(total_orders)
    
    # คำนวณ OT Penalty
    sales_18_22 = summary.get("sales_18_22", 0)
    commission_before_penalty = (
        summary.get("commission_1_total", 0) +
        summary.get("commission_5_total", 0) +
        summary.get("add_on_2vases", 0) +
        add_on_order
    )
    ot_penalty = commission_calculator.calculate_ot_penalty(commission_before_penalty, sales_18_22)
    
    # คำนวณคอมมิชชั่นรวม
    commission_total = commission_calculator.calculate_total_commission(
        summary.get("commission_1_total", 0),
        summary.get("commission_5_total", 0),
        summary.get("add_on_2vases", 0),
        add_on_order,
        ot_penalty
    )
    
    # คำนวณ Incentive ต่อคน
    staff_count = summary.get("staff_count", 1)
    incentive_per_person = commission_calculator.calculate_incentive_per_person(commission_total, staff_count)
    
    # อัพเดทยอดรวม
    db.update_totals(add_on_order, ot_penalty, commission_total, incentive_per_person)
    
    # ดึงข้อมูลสรุปใหม่
    summary = db.get_summary()
    
    # ส่งข้อความยืนยัน
    order_info = {
        "product_name": product_name,
        "amount": amount,
        "time": time,
        "commission_1": commission_info["commission_1"],
        "commission_5": commission_info["commission_5"],
        "add_on_2vases": commission_info["add_on_2vases"],
        "is_special": commission_info["is_special"],
        "rate": commission_info["rate"]
    }
    
    line_handler.send_order_confirmation(reply_token, order_info, summary)


@app.route("/")
def index():
    """หน้าแรก"""
    return """
    <html>
    <head>
        <title>ATMO'decor Commission System v2.0</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info { color: #666; }
        </style>
    </head>
    <body>
        <h1>🌸 ATMO'decor Commission System v2.0</h1>
        <div class="status">
            <h2>System Status: ✅ Running</h2>
            <p class="info">Webhook endpoint: <code>/webhook</code></p>
        </div>
        <h3>Features:</h3>
        <ul>
            <li>✅ เริ่มต้นวันด้วยปฏิทิน</li>
            <li>✅ แบ่งคอมมิชชั่นตามจำนวนคน</li>
            <li>✅ คำนวณคอมมิชชั่นอัตโนมัติ (1-4% และ 5%)</li>
            <li>✅ Add on (2vases) และ Add on (order)</li>
            <li>✅ OT Penalty ช่วง 18:00-22:00</li>
            <li>✅ เก็บรูปภาพออเดอร์</li>
        </ul>
    </body>
    </html>
    """


if __name__ == "__main__":
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
