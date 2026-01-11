"""
โมดูล LINE Webhook Handler สำหรับรับและประมวลผลข้อความจาก LINE
"""
from linebot import LineBotApi, WebhookHandler
from linebot.models import TextSendMessage
from typing import Dict


class LineHandler:
    """คลาสสำหรับจัดการ LINE Messaging API"""
    
    def __init__(self, channel_access_token: str, channel_secret: str):
        self.line_bot_api = LineBotApi(channel_access_token)
        self.handler = WebhookHandler(channel_secret)
    
    def reply_message(self, reply_token: str, message: str):
        """
        ตอบกลับข้อความไปยัง LINE
        
        Args:
            reply_token: Token สำหรับตอบกลับ
            message: ข้อความที่จะส่ง
        """
        self.line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text=message)
        )
    
    def push_message(self, to: str, message: str):
        """
        ส่งข้อความไปยัง LINE (ไม่ต้องมี reply_token)
        
        Args:
            to: User ID หรือ Group ID
            message: ข้อความที่จะส่ง
        """
        self.line_bot_api.push_message(
            to,
            TextSendMessage(text=message)
        )
    
    @staticmethod
    def format_summary_message(
        order_info: Dict,
        commission_info: Dict,
        summary: Dict
    ) -> str:
        """
        สร้างข้อความสรุปสำหรับตอบกลับ
        
        Args:
            order_info: ข้อมูลออเดอร์
            commission_info: ข้อมูลคอมมิชชั่น
            summary: ข้อมูลสรุปรวม
            
        Returns:
            ข้อความสรุป
        """
        # ข้อมูลออเดอร์นี้
        product_name = order_info.get("product_name", "")
        amount = order_info.get("amount", 0)
        commission = commission_info.get("commission", 0)
        base_commission = commission_info.get("base_commission", 0)
        special_bonus = commission_info.get("special_bonus", 0)
        rate = commission_info.get("rate", 0)
        is_special_rate = commission_info.get("is_special_rate", False)
        count_as_order = commission_info.get("count_as_order", True)
        vase_count = commission_info.get("vase_count", 0)
        
        # ข้อมูลสรุปรวม
        total_sales = summary.get("total_sales", 0)
        total_orders = summary.get("total_orders", 0)
        commission_total = summary.get("commission_total", 0)
        bonus_total = summary.get("bonus_total", 0)
        
        # สร้างข้อความ
        message_parts = ["✅ บันทึกออเดอร์สำเร็จ!\n"]
        
        # ข้อมูลออเดอร์นี้
        message_parts.append(f"📦 ออเดอร์นี้:")
        message_parts.append(f"• สินค้า: {product_name}")
        message_parts.append(f"• ยอดขาย: {amount:,.0f} บาท")
        
        if vase_count >= 2:
            message_parts.append(f"• จำนวนแจกัน: {vase_count} ใบ")
        
        if not count_as_order:
            message_parts.append(f"• คอมมิชชั่น: 0 บาท (ไม่นับเป็นออเดอร์)")
        elif total_sales < 20000:
            message_parts.append(f"• คอมมิชชั่น: 0 บาท (ยอดยังไม่ถึง 20,000)")
        else:
            rate_text = f"{rate*100:.0f}%"
            if is_special_rate:
                rate_text += " (พิเศษ)"
            
            message_parts.append(f"• เรท: {rate_text}")
            message_parts.append(f"• คอมมิชชั่น: {base_commission:,.0f} บาท")
            
            if special_bonus > 0:
                message_parts.append(f"• โบนัสแจกัน 2 ใบ+: +{special_bonus:,.0f} บาท")
            
            message_parts.append(f"• รวมคอมมิชชั่น: {commission:,.0f} บาท")
        
        # ข้อมูลสรุปรวม
        message_parts.append(f"\n📊 สรุปวันนี้:")
        message_parts.append(f"• ยอดขายสะสม: {total_sales:,.0f} บาท")
        message_parts.append(f"• จำนวนออเดอร์: {total_orders} ออเดอร์")
        
        # แสดงเรทปัจจุบันและเป้าหมายถัดไป
        if total_sales >= 180000:
            message_parts.append(f"• เรทปัจจุบัน: 4% (สูงสุด)")
        elif total_sales >= 100000:
            message_parts.append(f"• เรทปัจจุบัน: 3%")
            message_parts.append(f"• เป้าหมายถัดไป: 180,000 บาท (4%)")
        elif total_sales >= 50000:
            message_parts.append(f"• เรทปัจจุบัน: 2%")
            message_parts.append(f"• เป้าหมายถัดไป: 100,000 บาท (3%)")
        elif total_sales >= 20000:
            message_parts.append(f"• เรทปัจจุบัน: 1%")
            message_parts.append(f"• เป้าหมายถัดไป: 50,000 บาท (2%)")
        else:
            message_parts.append(f"• เรทปัจจุบัน: 0%")
            message_parts.append(f"• เป้าหมายถัดไป: 20,000 บาท (1%)")
        
        message_parts.append(f"• คอมมิชชั่นสะสม: {commission_total:,.0f} บาท")
        
        if bonus_total > 0:
            message_parts.append(f"• โบนัสออเดอร์: {bonus_total:,.0f} บาท")
        
        # รวมคอมมิชชั่นทั้งหมด
        grand_total = commission_total + bonus_total
        if grand_total > 0:
            message_parts.append(f"\n💰 รวมทั้งหมด: {grand_total:,.0f} บาท")
        
        return "\n".join(message_parts)
    
    @staticmethod
    def format_reset_message(summary: Dict) -> str:
        """
        สร้างข้อความสรุปก่อนรีเซ็ต
        
        Args:
            summary: ข้อมูลสรุปของวันที่ผ่านมา
            
        Returns:
            ข้อความสรุป
        """
        total_sales = summary.get("total_sales", 0)
        total_orders = summary.get("total_orders", 0)
        commission_total = summary.get("commission_total", 0)
        bonus_total = summary.get("bonus_total", 0)
        grand_total = commission_total + bonus_total
        
        message_parts = [
            "🌙 สรุปยอดประจำวัน",
            f"วันที่: {summary.get('date', '')}",
            "",
            f"📊 ยอดขายรวม: {total_sales:,.0f} บาท",
            f"📦 จำนวนออเดอร์: {total_orders} ออเดอร์",
            f"💰 คอมมิชชั่นรวม: {commission_total:,.0f} บาท"
        ]
        
        if bonus_total > 0:
            message_parts.append(f"🎁 โบนัสออเดอร์: {bonus_total:,.0f} บาท")
        
        message_parts.append(f"💵 รวมทั้งหมด: {grand_total:,.0f} บาท")
        message_parts.append("")
        message_parts.append("✨ ระบบได้รีเซ็ตข้อมูลเป็น 0 แล้ว")
        message_parts.append("เริ่มต้นวันใหม่กันเลย! 🚀")
        
        return "\n".join(message_parts)
