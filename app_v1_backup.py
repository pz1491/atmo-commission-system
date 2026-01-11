"""
แอปพลิเคชันหลักสำหรับระบบคำนวณคอมมิชชั่น ATMO'decor
"""
import os
from datetime import datetime, time
from flask import Flask, request, abort
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
import pytz

from src.commission_calculator import CommissionCalculator
from src.database import Database
from src.line_handler import LineHandler

# โหลด environment variables
load_dotenv()

# สร้าง Flask app
app = Flask(__name__)

# ตั้งค่า timezone
TIMEZONE = pytz.timezone(os.getenv('TIMEZONE', 'Asia/Bangkok'))

# สร้าง instances
db = Database(data_dir="data")
calculator = CommissionCalculator()
line_handler = LineHandler(
    channel_access_token=os.getenv('LINE_CHANNEL_ACCESS_TOKEN'),
    channel_secret=os.getenv('LINE_CHANNEL_SECRET')
)

# สร้าง scheduler สำหรับรีเซ็ตอัตโนมัติ
scheduler = BackgroundScheduler(timezone=TIMEZONE)


def reset_daily_data():
    """ฟังก์ชันสำหรับรีเซ็ตข้อมูลประจำวัน"""
    print(f"[{datetime.now()}] Running daily reset...")
    
    # ดึงข้อมูลสรุปก่อนรีเซ็ต
    summary = db.get_summary()
    
    # รีเซ็ตข้อมูล
    db.reset_data()
    
    print(f"[{datetime.now()}] Daily reset completed!")
    print(f"Summary: Sales={summary['total_sales']}, Orders={summary['total_orders']}, Commission={summary['commission_total']}")


def check_and_reset_on_startup():
    """ตรวจสอบและรีเซ็ตข้อมูลเมื่อเริ่มต้นระบบ (กรณีระบบปิดข้ามวัน)"""
    if db.check_and_reset_if_new_day():
        print(f"[{datetime.now()}] Data reset on startup (new day detected)")


# ตั้งค่า scheduler ให้รันทุกวันเวลา 23:59
scheduler.add_job(
    func=reset_daily_data,
    trigger='cron',
    hour=23,
    minute=59,
    second=0,
    id='daily_reset'
)

# เริ่มต้น scheduler
scheduler.start()

# ตรวจสอบและรีเซ็ตเมื่อเริ่มต้นระบบ
check_and_reset_on_startup()


@app.route("/webhook", methods=['POST'])
def webhook():
    """
    Webhook endpoint สำหรับรับข้อความจาก LINE
    """
    # ดึง signature จาก header
    signature = request.headers.get('X-Line-Signature')
    if not signature:
        abort(400)
    
    # ดึง body
    body = request.get_data(as_text=True)
    
    try:
        # ตรวจสอบ signature และประมวลผล events
        line_handler.handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)
    
    return 'OK'


@line_handler.handler.add(MessageEvent, message=TextMessage)
def handle_text_message(event):
    """
    ประมวลผลข้อความที่ได้รับจาก LINE
    """
    text = event.message.text
    reply_token = event.reply_token
    
    # ตรวจสอบคำสั่งพิเศษ
    if text.lower() in ['/summary', '/สรุป']:
        # แสดงสรุปยอดวันนี้
        summary = db.get_summary()
        message = format_summary_only(summary)
        line_handler.reply_message(reply_token, message)
        return
    
    if text.lower() in ['/reset', '/รีเซ็ต']:
        # รีเซ็ตข้อมูล (ใช้ด้วยความระมัดระวัง)
        summary = db.get_summary()
        db.reset_data()
        message = line_handler.format_reset_message(summary)
        line_handler.reply_message(reply_token, message)
        return
    
    if text.lower() in ['/help', '/ช่วยเหลือ']:
        # แสดงคำสั่งที่ใช้ได้
        help_message = """
📖 คำสั่งที่ใช้ได้:

/summary หรือ /สรุป
• แสดงสรุปยอดขายและคอมมิชชั่นวันนี้

/reset หรือ /รีเซ็ต
• รีเซ็ตข้อมูลเป็น 0 (ใช้ด้วยความระมัดระวัง)

/help หรือ /ช่วยเหลือ
• แสดงคำสั่งนี้

📝 วิธีใช้งาน:
ส่งข้อความออเดอร์ตามปกติ ระบบจะคำนวณคอมมิชชั่นอัตโนมัติ
        """
        line_handler.reply_message(reply_token, help_message.strip())
        return
    
    # แยกวิเคราะห์ข้อมูลสินค้า
    product_info = calculator.extract_product_info(text)
    
    # ตรวจสอบว่าหายอดเงินได้หรือไม่
    if product_info["amount"] is None:
        # ไม่พบยอดเงิน ไม่ต้องประมวลผล
        return
    
    # ดึงยอดรวมปัจจุบัน
    current_sales, current_orders = db.get_current_totals()
    
    # คำนวณยอดรวมใหม่ (รวมออเดอร์นี้)
    new_total_sales = current_sales + product_info["amount"]
    
    # คำนวณจำนวนออเดอร์ใหม่
    commission_info_temp = calculator.calculate_commission(
        order_amount=product_info["amount"],
        total_sales=new_total_sales,
        total_orders=current_orders + 1,
        product_info=product_info
    )
    
    new_total_orders = current_orders + (1 if commission_info_temp["count_as_order"] else 0)
    
    # คำนวณคอมมิชชั่นอีกครั้งด้วยจำนวนออเดอร์ที่ถูกต้อง
    commission_info = calculator.calculate_commission(
        order_amount=product_info["amount"],
        total_sales=new_total_sales,
        total_orders=new_total_orders,
        product_info=product_info
    )
    
    # บันทึกออเดอร์
    summary = db.add_order(
        amount=product_info["amount"],
        product_name=product_info["product_name"],
        commission_info=commission_info,
        product_info=product_info
    )
    
    # สร้างข้อความตอบกลับ
    message = line_handler.format_summary_message(
        order_info=product_info,
        commission_info=commission_info,
        summary=summary
    )
    
    # ตอบกลับ
    line_handler.reply_message(reply_token, message)


def format_summary_only(summary: dict) -> str:
    """สร้างข้อความสรุปยอดวันนี้"""
    total_sales = summary.get("total_sales", 0)
    total_orders = summary.get("total_orders", 0)
    commission_total = summary.get("commission_total", 0)
    bonus_total = summary.get("bonus_total", 0)
    grand_total = commission_total + bonus_total
    
    message_parts = [
        "📊 สรุปยอดวันนี้",
        f"วันที่: {summary.get('date', '')}",
        "",
        f"• ยอดขายสะสม: {total_sales:,.0f} บาท",
        f"• จำนวนออเดอร์: {total_orders} ออเดอร์"
    ]
    
    # แสดงเรทปัจจุบัน
    if total_sales >= 180000:
        message_parts.append(f"• เรทปัจจุบัน: 4% (สูงสุด)")
    elif total_sales >= 100000:
        message_parts.append(f"• เรทปัจจุบัน: 3%")
    elif total_sales >= 50000:
        message_parts.append(f"• เรทปัจจุบัน: 2%")
    elif total_sales >= 20000:
        message_parts.append(f"• เรทปัจจุบัน: 1%")
    else:
        message_parts.append(f"• เรทปัจจุบัน: 0% (ยังไม่ถึง 20,000)")
    
    message_parts.append(f"• คอมมิชชั่นสะสม: {commission_total:,.0f} บาท")
    
    if bonus_total > 0:
        message_parts.append(f"• โบนัสออเดอร์: {bonus_total:,.0f} บาท")
    
    message_parts.append(f"\n💰 รวมทั้งหมด: {grand_total:,.0f} บาท")
    
    return "\n".join(message_parts)


@app.route("/health", methods=['GET'])
def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "date": db.data["date"],
        "total_sales": db.data["total_sales"],
        "total_orders": db.data["total_orders"]
    }


@app.route("/", methods=['GET'])
def index():
    """หน้าแรก"""
    return """
    <html>
    <head>
        <title>ATMO'decor Commission System</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .info { color: #666; }
        </style>
    </head>
    <body>
        <h1>🌸 ATMO'decor Commission System</h1>
        <div class="status">
            <h2>System Status: ✅ Running</h2>
            <p class="info">Webhook endpoint: <code>/webhook</code></p>
            <p class="info">Health check: <code>/health</code></p>
        </div>
        <h3>Features:</h3>
        <ul>
            <li>✅ รับออเดอร์จาก LINE OA</li>
            <li>✅ คำนวณคอมมิชชั่นอัตโนมัติ</li>
            <li>✅ สะสมยอดขายและออเดอร์รายวัน</li>
            <li>✅ รีเซ็ตอัตโนมัติเวลา 23:59 น.</li>
            <li>✅ รองรับคอมมิชชั่นพิเศษหลายรูปแบบ</li>
        </ul>
    </body>
    </html>
    """


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
