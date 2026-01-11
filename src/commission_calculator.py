# -*- coding: utf-8 -*-
"""
โมดูลคำนวณคอมมิชชั่น ATMO'decor - Version 2.1
อัพเดท: คำนวณจากส่วนต่างที่เกิน 20,000 บาท
"""

import re
from datetime import datetime
from typing import Dict, Tuple, Optional, List

# เงื่อนไขคอมมิชชั่นหลัก (ยอดขั้นต่ำ, เรท, จำนวนออเดอร์สำหรับโบนัส, โบนัส)
COMMISSION_TIERS = [
    {"min": 180000, "rate": 0.04, "bonus_orders": 12, "bonus_amount": 1500},
    {"min": 100000, "rate": 0.03, "bonus_orders": None, "bonus_amount": 0},
    {"min": 70000, "rate": 0.02, "bonus_orders": 8, "bonus_amount": 800},
    {"min": 50000, "rate": 0.02, "bonus_orders": 6, "bonus_amount": 400},
    {"min": 20000, "rate": 0.01, "bonus_orders": 3, "bonus_amount": 100},
]

# คำสำคัญสำหรับสินค้าพิเศษ (คอมมิชชั่น 5%)
FALAND_KEYWORDS = ["ฟาแลน", "faland", "ฟาแลนด์"]
IKEBANA_CURVE_KEYWORDS = ["ikebana curve", "curve"]
FLOWER_ONLY_KEYWORDS = ["ดอกไม้อย่างเดียว", "ชุดดอกไม้", "ikebana", "จัดเอง"]

# คำสำคัญที่ไม่นับออเดอร์
PERFUME_KEYWORDS = ["น้ำหอม", "perfume"]
MINI_VASE_KEYWORDS = ["mini vase", "minivase", "มินิเวส"]

# คำสำคัญสำหรับแจกัน
VASE_KEYWORDS = ["แจกัน", "vase", "เวส"]

# ยอดขั้นต่ำ
MIN_SALES_THRESHOLD = 20000

# ราคาขั้นต่ำสำหรับชุดดอกไม้อย่างเดียวที่ได้ 5%
MIN_FLOWER_ONLY_PRICE = 8000

# ราคาขั้นต่ำสำหรับแจกันที่นับเป็น 2 vases
MIN_VASE_PRICE = 4500

# ยอดที่เปลี่ยน Add on (2vases) จาก 500 เป็น 300
VASE_ADDON_THRESHOLD = 9500

# OT Penalty
OT_EVENING_MIN_SALES = 5000  # ยอดขั้นต่ำช่วง 18:00-22:00
OT_PENALTY_RATE = 0.30  # หัก 30%
OT_PENALTY_MAX = 300  # สูงสุด 300 บาท


def extract_amount(text: str) -> Optional[float]:
    """
    ดึงยอดเงินจากข้อความ
    
    Args:
        text: ข้อความที่มียอดเงิน
        
    Returns:
        ยอดเงิน หรือ None ถ้าไม่พบ
    """
    # ลบเครื่องหมายคอมม่า
    text = text.replace(',', '')
    
    # หารูปแบบตัวเลข
    patterns = [
        r'(\d+(?:\.\d+)?)\s*บาท',  # "3000 บาท" หรือ "3000บาท"
        r'^\s*(\d+(?:\.\d+)?)\s*$',  # "3000" (บรรทัดที่มีแต่ตัวเลข)
        r'ยอด\s*(\d+(?:\.\d+)?)',  # "ยอด 3000"
        r'ราคา\s*(\d+(?:\.\d+)?)',  # "ราคา 3000"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.MULTILINE)
        if match:
            return float(match.group(1))
    
    return None


def extract_time(text: str) -> Optional[str]:
    """
    ดึงเวลาจากข้อความ
    
    Args:
        text: ข้อความที่มีเวลา
        
    Returns:
        เวลาในรูปแบบ "HH:MM" หรือ None ถ้าไม่พบ
    """
    # หารูปแบบเวลา
    patterns = [
        r'(\d{1,2}):(\d{2})',  # "13:40"
        r'(\d{1,2})\.(\d{2})',  # "13.40"
        r'เวลา\s*(\d{1,2}):(\d{2})',  # "เวลา 13:40"
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2))
            return f"{hour:02d}:{minute:02d}"
    
    return None


def is_time_in_range(time_str: str, start_hour: int, end_hour: int) -> bool:
    """
    ตรวจสอบว่าเวลาอยู่ในช่วงที่กำหนดหรือไม่
    
    Args:
        time_str: เวลาในรูปแบบ "HH:MM"
        start_hour: ชั่วโมงเริ่มต้น
        end_hour: ชั่วโมงสิ้นสุด
        
    Returns:
        True ถ้าอยู่ในช่วง, False ถ้าไม่อยู่
    """
    if not time_str:
        return False
    
    try:
        hour = int(time_str.split(':')[0])
        return start_hour <= hour < end_hour
    except:
        return False


def count_vase_items(text: str) -> int:
    """
    นับจำนวนรายการแจกันในข้อความ
    
    Args:
        text: ข้อความออเดอร์
        
    Returns:
        จำนวนรายการแจกัน
    """
    # แยกข้อความเป็นบรรทัด
    lines = text.split('\n')
    
    count = 0
    for line in lines:
        line_lower = line.lower()
        # ตรวจสอบว่ามีคำว่า "แจกัน" หรือ "vase"
        if any(keyword in line_lower for keyword in VASE_KEYWORDS):
            # ตรวจสอบว่าไม่ใช่ Mini vase
            if not any(keyword in line_lower for keyword in MINI_VASE_KEYWORDS):
                count += 1
    
    return count


def check_product_type(product_name: str) -> Dict[str, bool]:
    """
    ตรวจสอบประเภทสินค้า
    
    Args:
        product_name: ชื่อสินค้า
        
    Returns:
        Dictionary ที่มีข้อมูลประเภทสินค้า
    """
    product_lower = product_name.lower()
    
    return {
        "is_faland": any(keyword in product_lower for keyword in FALAND_KEYWORDS),
        "is_ikebana_curve": any(keyword in product_lower for keyword in IKEBANA_CURVE_KEYWORDS),
        "is_flower_only": any(keyword in product_lower for keyword in FLOWER_ONLY_KEYWORDS),
        "is_perfume": any(keyword in product_lower for keyword in PERFUME_KEYWORDS),
        "is_mini_vase": any(keyword in product_lower for keyword in MINI_VASE_KEYWORDS),
        "is_vase": any(keyword in product_lower for keyword in VASE_KEYWORDS),
    }


def calculate_commission_rate(total_sales: float) -> Tuple[float, int, int]:
    """
    คำนวณเรทคอมมิชชั่นตามยอดขายสะสม
    
    Args:
        total_sales: ยอดขายสะสม
        
    Returns:
        Tuple (เรทคอมมิชชั่น, จำนวนออเดอร์สำหรับโบนัส, จำนวนเงินโบนัส)
    """
    if total_sales < MIN_SALES_THRESHOLD:
        return 0.0, 0, 0
    
    for tier in COMMISSION_TIERS:
        if total_sales >= tier["min"]:
            return tier["rate"], tier["bonus_orders"] or 0, tier["bonus_amount"]
    
    return 0.0, 0, 0


def calculate_commission_from_excess(total_sales: float, previous_sales: float = 0) -> float:
    """
    คำนวณคอมมิชชั่นจากส่วนต่างที่เกินยอดขั้นต่ำ
    
    Args:
        total_sales: ยอดขายสะสมปัจจุบัน
        previous_sales: ยอดขายสะสมก่อนหน้า
        
    Returns:
        คอมมิชชั่นจากส่วนต่าง
    """
    if total_sales < MIN_SALES_THRESHOLD:
        return 0.0
    
    # หาเรทปัจจุบัน
    current_rate, _, _ = calculate_commission_rate(total_sales)
    
    # คำนวณส่วนต่างที่เกิน 20,000
    excess = total_sales - MIN_SALES_THRESHOLD
    
    # คำนวณคอมมิชชั่นจากส่วนต่าง
    commission = excess * current_rate
    
    return commission


def calculate_order_commission(
    amount: float,
    product_name: str,
    order_text: str = "",
    total_sales: float = 0
) -> Dict:
    """
    คำนวณคอมมิชชั่นสำหรับออเดอร์หนึ่ง
    
    Args:
        amount: ยอดเงินของออเดอร์
        product_name: ชื่อสินค้า
        order_text: ข้อความออเดอร์ทั้งหมด
        total_sales: ยอดขายสะสมปัจจุบัน
        
    Returns:
        Dictionary ที่มีข้อมูลคอมมิชชั่น
    """
    product_type = check_product_type(product_name)
    
    # ตรวจสอบว่านับเป็นออเดอร์หรือไม่
    count_as_order = not product_type["is_perfume"]
    
    # นับจำนวนรายการแจกัน
    vase_count = count_vase_items(order_text) if order_text else 0
    
    # คำนวณคอมมิชชั่น 5% (สินค้าพิเศษ)
    commission_5 = 0.0
    is_special = False
    
    if product_type["is_faland"] and not product_type["is_ikebana_curve"]:
        # แจกันฟาแลน (ยกเว้น Ikebana Curve)
        commission_5 = amount * 0.05
        is_special = True
    elif product_type["is_ikebana_curve"]:
        # Ikebana Curve
        commission_5 = amount * 0.05
        is_special = True
    elif product_type["is_flower_only"] and amount >= MIN_FLOWER_ONLY_PRICE:
        # ชุดดอกไม้อย่างเดียว (≥8,000 บาท)
        commission_5 = amount * 0.05
        is_special = True
    
    # คำนวณ Add on (2vases)
    add_on_2vases = 0.0
    if vase_count >= 2 and amount >= MIN_VASE_PRICE:
        if amount > VASE_ADDON_THRESHOLD:
            add_on_2vases = 300
        else:
            add_on_2vases = 500
    
    return {
        "commission_5": commission_5,
        "add_on_2vases": add_on_2vases,
        "is_special": is_special,
        "count_as_order": count_as_order,
        "vase_count": vase_count,
        "product_type": product_type
    }


def calculate_order_bonus(total_orders: int) -> int:
    """
    คำนวณโบนัสตามจำนวนออเดอร์
    
    Args:
        total_orders: จำนวนออเดอร์ทั้งหมด
        
    Returns:
        จำนวนเงินโบนัส
    """
    # ตรวจสอบจากมากไปน้อย
    if total_orders >= 12:
        return 1500
    elif total_orders >= 8:
        return 800
    elif total_orders >= 6:
        return 400
    elif total_orders >= 3:
        return 100
    else:
        return 0


def calculate_ot_penalty(
    total_commission: float,
    sales_18_22: float
) -> float:
    """
    คำนวณ OT Penalty
    
    Args:
        total_commission: คอมมิชชั่นรวมทั้งวัน
        sales_18_22: ยอดขายช่วง 18:00-22:00
        
    Returns:
        จำนวนเงินที่ต้องหัก
    """
    if sales_18_22 < OT_EVENING_MIN_SALES:
        penalty = total_commission * OT_PENALTY_RATE
        return min(penalty, OT_PENALTY_MAX)
    return 0.0


def calculate_total_commission(
    commission_1_total: float,
    commission_5_total: float,
    add_on_2vases_total: float,
    add_on_order: float,
    ot_penalty: float
) -> float:
    """
    คำนวณคอมมิชชั่นรวมทั้งหมด
    
    Args:
        commission_1_total: คอมมิชชั่น 1% รวม
        commission_5_total: คอมมิชชั่น 5% รวม
        add_on_2vases_total: Add on (2vases) รวม
        add_on_order: Add on (order)
        ot_penalty: OT Penalty
        
    Returns:
        คอมมิชชั่นรวมสุทธิ
    """
    total = commission_1_total + commission_5_total + add_on_2vases_total + add_on_order
    return max(0, total - ot_penalty)


def calculate_incentive_per_person(total_commission: float, staff_count: int) -> float:
    """
    คำนวณ Incentive ต่อคน
    
    Args:
        total_commission: คอมมิชชั่นรวมทั้งวัน
        staff_count: จำนวนคนตอบ
        
    Returns:
        Incentive ต่อคน
    """
    if staff_count <= 0:
        return 0.0
    return total_commission / staff_count


def format_summary(data: Dict) -> str:
    """
    จัดรูปแบบข้อความสรุป
    
    Args:
        data: ข้อมูลสรุป
        
    Returns:
        ข้อความสรุปที่จัดรูปแบบแล้ว
    """
    date = data.get("date", "")
    staff_count = data.get("staff_count", 0)
    staff_names = ", ".join(data.get("staff_names", []))
    total_sales = data.get("total_sales", 0)
    total_orders = data.get("total_orders", 0)
    
    commission_1 = data.get("commission_1_total", 0)
    commission_5 = data.get("commission_5_total", 0)
    add_on_2vases = data.get("add_on_2vases", 0)
    add_on_order = data.get("add_on_order", 0)
    
    sales_18_22 = data.get("sales_18_22", 0)
    ot_penalty = data.get("ot_penalty", 0)
    
    commission_total = data.get("commission_total", 0)
    incentive_per_person = data.get("incentive_per_person", 0)
    
    rate, _, _ = calculate_commission_rate(total_sales)
    
    # ส่วนต่างที่เกิน 20,000
    excess = max(0, total_sales - MIN_SALES_THRESHOLD)
    
    # สถานะ OT
    ot_status = "✅" if sales_18_22 >= OT_EVENING_MIN_SALES else "❌"
    
    summary = f"""📊 สรุปยอดวันนี้ ({date})
👥 คนตอบ: {staff_names} ({staff_count} คน)

• ยอดขายรวม: {total_sales:,.0f} บาท
• ส่วนต่าง (เกิน 20,000): {excess:,.0f} บาท
• จำนวนออเดอร์: {total_orders} ออเดอร์
• เรทปัจจุบัน: {rate*100:.0f}%

💰 คอมมิชชั่น:
• คอมมิชชั่น 1-4%: {commission_1:,.2f} บาท
• คอมมิชชั่น 5%: {commission_5:,.2f} บาท
• Add on (2vases): {add_on_2vases:,.0f} บาท
• Add on (order): {add_on_order:,.0f} บาท

⏰ OT:
• ช่วง 18:00-22:00: {sales_18_22:,.0f} บาท {ot_status}
• Penalty: {ot_penalty:,.0f} บาท

💵 รวมทั้งหมด: {commission_total:,.2f} บาท
💵 Incentive ต่อคน: {incentive_per_person:,.2f} บาท"""
    
    return summary
