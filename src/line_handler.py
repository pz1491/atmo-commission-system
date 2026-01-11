# -*- coding: utf-8 -*-
"""
โมดูล LINE Handler ATMO'decor - Version 2.0
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from linebot import LineBotApi, WebhookHandler
from linebot.models import (
    TextSendMessage,
    FlexSendMessage,
    ImageSendMessage,
    QuickReply,
    QuickReplyButton,
    DatetimePickerAction,
    MessageAction
)


class LineHandler:
    """คลาสสำหรับจัดการ LINE Messaging API"""
    
    def __init__(self, channel_access_token: str, channel_secret: str):
        """
        สร้าง instance ของ LineHandler
        
        Args:
            channel_access_token: LINE Channel Access Token
            channel_secret: LINE Channel Secret
        """
        self.line_bot_api = LineBotApi(channel_access_token)
        self.handler = WebhookHandler(channel_secret)
        self.user_states = {}  # เก็บสถานะของผู้ใช้แต่ละคน
    
    def send_message(self, reply_token: str, message: str):
        """
        ส่งข้อความตอบกลับ
        
        Args:
            reply_token: Reply token จาก LINE
            message: ข้อความที่จะส่ง
        """
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text=message)
        )
    
    def reply_message(self, reply_token: str, message: str):
        """Alias สำหรับ send_message เพื่อความเข้ากันได้"""
        self.send_message(reply_token, message)
    
    def send_start_date_picker(self, reply_token: str):
        """
        ส่ง Date Picker สำหรับเลือกวันที่
        
        Args:
            reply_token: Reply token จาก LINE
        """
        # สร้าง Flex Message พร้อม Date Picker
        today = datetime.now()
        
        flex_message = FlexSendMessage(
            alt_text="เลือกวันที่",
            contents={
                "type": "bubble",
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        {
                            "type": "text",
                            "text": "🗓️ เริ่มต้นวันใหม่",
                            "weight": "bold",
                            "size": "xl",
                            "color": "#1DB446"
                        },
                        {
                            "type": "text",
                            "text": "กรุณาเลือกวันที่",
                            "size": "sm",
                            "color": "#999999",
                            "margin": "md"
                        }
                    ]
                },
                "footer": {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "contents": [
                        {
                            "type": "button",
                            "style": "primary",
                            "action": {
                                "type": "datetimepicker",
                                "label": "เลือกวันที่",
                                "data": "action=select_date",
                                "mode": "date",
                                "initial": today.strftime("%Y-%m-%d"),
                                "max": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
                                "min": (today - timedelta(days=30)).strftime("%Y-%m-%d")
                            }
                        }
                    ]
                }
            }
        )
        
        self.line_bot_api.reply_message(reply_token, flex_message)
    
    def send_staff_count_question(self, reply_token: str):
        """
        ถามจำนวนคนตอบ
        
        Args:
            reply_token: Reply token จาก LINE
        """
        quick_reply = QuickReply(
            items=[
                QuickReplyButton(action=MessageAction(label="1 คน", text="1")),
                QuickReplyButton(action=MessageAction(label="2 คน", text="2")),
                QuickReplyButton(action=MessageAction(label="3 คน", text="3")),
                QuickReplyButton(action=MessageAction(label="4 คน", text="4")),
                QuickReplyButton(action=MessageAction(label="5 คน", text="5")),
            ]
        )
        
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(
                text="👥 มีคนตอบกี่คน?",
                quick_reply=quick_reply
            )
        )
    
    def send_staff_names_question(self, reply_token: str):
        """
        ถามชื่อผู้ตอบ
        
        Args:
            reply_token: Reply token จาก LINE
        """
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text="📝 ชื่อผู้ตอบ? (คั่นด้วยเครื่องหมายคอมม่า เช่น Oil, Fang, Phung)")
        )
    
    def send_order_confirmation(self, reply_token: str, order_info: Dict, summary: Dict):
        """
        ส่งข้อความยืนยันการบันทึกออเดอร์
        
        Args:
            reply_token: Reply token จาก LINE
            order_info: ข้อมูลออเดอร์
            summary: ข้อมูลสรุปยอด
        """
        product_name = order_info.get("product_name", "")
        amount = order_info.get("amount", 0)
        time = order_info.get("time", "")
        commission_1 = order_info.get("commission_1", 0)
        commission_5 = order_info.get("commission_5", 0)
        add_on_2vases = order_info.get("add_on_2vases", 0)
        is_special = order_info.get("is_special", False)
        
        # คำนวณคอมมิชชั่นรวมของออเดอร์นี้
        order_commission = commission_1 + commission_5 + add_on_2vases
        rate_text = "5%" if is_special else f"{order_info.get('rate', 0)*100:.0f}%"
        
        # ข้อมูลสรุปวันนี้
        date = summary.get("date", "")
        staff_count = summary.get("staff_count", 0)
        staff_names = ", ".join(summary.get("staff_names", []))
        total_sales = summary.get("total_sales", 0)
        total_orders = summary.get("total_orders", 0)
        
        commission_1_total = summary.get("commission_1_total", 0)
        commission_5_total = summary.get("commission_5_total", 0)
        add_on_2vases_total = summary.get("add_on_2vases", 0)
        add_on_order = summary.get("add_on_order", 0)
        
        sales_18_22 = summary.get("sales_18_22", 0)
        ot_penalty = summary.get("ot_penalty", 0)
        
        commission_total = summary.get("commission_total", 0)
        incentive_per_person = summary.get("incentive_per_person", 0)
        
        # คำนวณเรทปัจจุบัน
        from . import commission_calculator
        rate, _, _ = commission_calculator.calculate_commission_rate(total_sales)
        
        # สถานะ OT
        ot_status = "✅" if sales_18_22 >= commission_calculator.OT_EVENING_MIN_SALES else "❌"
        
        message = f"""✅ บันทึกออเดอร์สำเร็จ!

📦 ออเดอร์นี้:
• สินค้า: {product_name}
• ยอดขาย: {amount:,.0f} บาท
• เวลา: {time}
• คอมมิชชั่น: {order_commission:,.0f} บาท ({rate_text})

📊 สรุปวันนี้ ({date})
👥 คนตอบ: {staff_names} ({staff_count} คน)

• ยอดขายรวม: {total_sales:,.0f} บาท
• จำนวนออเดอร์: {total_orders} ออเดอร์
• เรทปัจจุบัน: {rate*100:.0f}%

💰 คอมมิชชั่น:
• คอมมิชชั่น 1-4%: {commission_1_total:,.0f} บาท
• คอมมิชชั่น 5%: {commission_5_total:,.0f} บาท
• Add on (2vases): {add_on_2vases_total:,.0f} บาท
• Add on (order): {add_on_order:,.0f} บาท

⏰ OT:
• ช่วง 18:00-22:00: {sales_18_22:,.0f} บาท {ot_status}
• Penalty: {ot_penalty:,.0f} บาท

💵 รวมทั้งหมด: {commission_total:,.0f} บาท
💵 Incentive ต่อคน: {incentive_per_person:,.2f} บาท"""
        
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text=message)
        )
    
    def send_summary(self, reply_token: str, summary: Dict):
        """
        ส่งข้อความสรุปยอด
        
        Args:
            reply_token: Reply token จาก LINE
            summary: ข้อมูลสรุป
        """
        from . import commission_calculator
        message = commission_calculator.format_summary(summary)
        
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text=message)
        )
    
    def send_images_gallery(self, reply_token: str, image_paths: List[str]):
        """
        ส่งแกลเลอรี่รูปภาพ
        
        Args:
            reply_token: Reply token จาก LINE
            image_paths: รายการ path ของรูปภาพ
        """
        if not image_paths:
            self.line_bot_api.reply_message(
                reply_token,
                TextSendMessage(text="ยังไม่มีรูปภาพออเดอร์")
            )
            return
        
        message = f"📸 รูปภาพออเดอร์ทั้งหมด ({len(image_paths)} รูป)\n\n"
        message += "รูปภาพถูกเก็บไว้ที่:\n"
        for i, path in enumerate(image_paths, 1):
            message += f"{i}. {path}\n"
        
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text=message)
        )
    
    def send_help(self, reply_token: str):
        """
        ส่งข้อความช่วยเหลือ
        
        Args:
            reply_token: Reply token จาก LINE
        """
        help_text = """📚 คำสั่งที่ใช้ได้

🔹 /start - เริ่มต้นวันใหม่
   (ระบุวันที่, จำนวนคน, ชื่อผู้ตอบ)

🔹 /summary - แสดงสรุปยอดวันนี้

🔹 /images - ดูรูปภาพออเดอร์ทั้งหมด

🔹 /reset - รีเซ็ตข้อมูล

🔹 /help - แสดงคำสั่งนี้

📝 การส่งออเดอร์:
ส่งข้อความพร้อมรูปภาพ โดยมีข้อมูล:
- ชื่อสินค้า
- ยอดเงิน
- เวลา
- หมายเหตุ

ตัวอย่าง:
1. แจกันดอกไม้ 1
25,000 บาท 13:40
คุณ ทดสอบ
..."""
        
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text=help_text)
        )
    
    def download_image(self, message_id: str) -> bytes:
        """
        ดาวน์โหลดรูปภาพจาก LINE
        
        Args:
            message_id: Message ID ของรูปภาพ
            
        Returns:
            ข้อมูลรูปภาพ (bytes)
        """
        message_content = self.line_bot_api.get_message_content(message_id)
        image_data = b''
        for chunk in message_content.iter_content():
            image_data += chunk
        return image_data
    
    def get_user_state(self, user_id: str) -> Dict:
        """
        ดึงสถานะของผู้ใช้
        
        Args:
            user_id: LINE User ID
            
        Returns:
            สถานะของผู้ใช้
        """
        if user_id not in self.user_states:
            self.user_states[user_id] = {"state": "idle"}
        return self.user_states[user_id]
    
    def set_user_state(self, user_id: str, state: str, data: Optional[Dict] = None):
        """
        ตั้งค่าสถานะของผู้ใช้
        
        Args:
            user_id: LINE User ID
            state: สถานะใหม่
            data: ข้อมูลเพิ่มเติม
        """
        self.user_states[user_id] = {"state": state}
        if data:
            self.user_states[user_id].update(data)
    
    def clear_user_state(self, user_id: str):
        """
        ล้างสถานะของผู้ใช้
        
        Args:
            user_id: LINE User ID
        """
        if user_id in self.user_states:
            del self.user_states[user_id]
