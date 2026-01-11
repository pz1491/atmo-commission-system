"""
โมดูลคำนวณคอมมิชชั่นสำหรับ ATMO'decor
"""
import re
from typing import Dict, Tuple, Optional


class CommissionCalculator:
    """คลาสสำหรับคำนวณคอมมิชชั่นตามเงื่อนไขที่กำหนด"""
    
    # เรทคอมมิชชั่นหลัก
    COMMISSION_TIERS = [
        {"min": 180000, "rate": 0.04, "bonus_orders": 12, "bonus_amount": 1500},
        {"min": 100000, "rate": 0.03, "bonus_orders": 8, "bonus_amount": 800},
        {"min": 50000, "rate": 0.02, "bonus_orders": 6, "bonus_amount": 400},
        {"min": 20000, "rate": 0.01, "bonus_orders": 3, "bonus_amount": 100},
    ]
    
    # คำสำคัญสำหรับตรวจสอบประเภทสินค้า
    MINI_VASE_KEYWORDS = ["mini vase", "minivase"]
    PERFUME_KEYWORDS = ["น้ำหอม", "perfume"]
    IKEBANA_CURVE_KEYWORDS = ["ikebana curve"]
    FLOWER_ONLY_KEYWORDS = ["ดอกไม้อย่างเดียว", "ชุดดอกไม้", "ikebana", "จัดเอง"]
    VASE_KEYWORDS = ["แจกัน", "vase"]
    
    # ราคาขั้นต่ำสำหรับเงื่อนไขพิเศษ
    MIN_VASE_PRICE = 4500
    MIN_FLOWER_ONLY_PRICE = 8000
    SPECIAL_COMMISSION_RATE = 0.05
    MULTI_VASE_BONUS = 500
    
    def __init__(self):
        pass
    
    @staticmethod
    def extract_amount(text: str) -> Optional[float]:
        """
        ดึงยอดเงินจากข้อความ
        
        Args:
            text: ข้อความที่มียอดเงิน
            
        Returns:
            ยอดเงิน หรือ None ถ้าหาไม่เจอ
        """
        # ลบเครื่องหมาย comma ออกก่อน
        text = text.replace(",", "")
        
        # หาตัวเลขที่เป็นยอดเงิน (อาจมีจุดทศนิยม)
        pattern = r'\b(\d+(?:\.\d+)?)\b'
        matches = re.findall(pattern, text)
        
        # หายอดเงินที่มีค่ามากกว่า 100 (สมมติว่ายอดขายขั้นต่ำ)
        for match in matches:
            amount = float(match)
            if amount >= 100:
                return amount
        
        return None
    
    @staticmethod
    def extract_product_info(text: str) -> Dict[str, any]:
        """
        แยกวิเคราะห์ข้อมูลสินค้าจากข้อความ
        
        Args:
            text: ข้อความออเดอร์
            
        Returns:
            Dict ที่มีข้อมูล: product_name, amount, is_mini_vase, is_perfume, 
                             is_ikebana_curve, is_flower_only, vase_count
        """
        text_lower = text.lower()
        lines = text.split('\n')
        
        # บรรทัดแรกคือชื่อสินค้า
        product_name = lines[0].strip() if lines else ""
        
        # ดึงยอดเงิน
        amount = CommissionCalculator.extract_amount(text)
        
        # ตรวจสอบประเภทสินค้า
        is_mini_vase = any(keyword in text_lower for keyword in CommissionCalculator.MINI_VASE_KEYWORDS)
        is_perfume = any(keyword in text_lower for keyword in CommissionCalculator.PERFUME_KEYWORDS)
        is_ikebana_curve = any(keyword in text_lower for keyword in CommissionCalculator.IKEBANA_CURVE_KEYWORDS)
        is_flower_only = any(keyword in text_lower for keyword in CommissionCalculator.FLOWER_ONLY_KEYWORDS)
        
        # นับจำนวนแจกัน (หาตัวเลขหลังคำว่า "แจกัน" หรือ "vase")
        vase_count = 0
        if any(keyword in text_lower for keyword in CommissionCalculator.VASE_KEYWORDS):
            # หาตัวเลขที่อยู่ใกล้คำว่า "แจกัน" หรือ "vase"
            vase_pattern = r'(?:แจกัน|vase)[^\d]*(\d+)|(\d+)[^\d]*(?:แจกัน|vase)'
            vase_matches = re.findall(vase_pattern, text_lower)
            if vase_matches:
                for match in vase_matches:
                    count = int(match[0] or match[1])
                    vase_count = max(vase_count, count)
            else:
                # ถ้าไม่มีตัวเลข แต่มีคำว่าแจกัน ให้ถือว่า 1 แจกัน
                vase_count = 1
        
        return {
            "product_name": product_name,
            "amount": amount,
            "is_mini_vase": is_mini_vase,
            "is_perfume": is_perfume,
            "is_ikebana_curve": is_ikebana_curve,
            "is_flower_only": is_flower_only,
            "vase_count": vase_count
        }
    
    @staticmethod
    def calculate_commission(
        order_amount: float,
        total_sales: float,
        total_orders: int,
        product_info: Dict[str, any]
    ) -> Dict[str, any]:
        """
        คำนวณคอมมิชชั่นสำหรับออเดอร์
        
        Args:
            order_amount: ยอดขายของออเดอร์นี้
            total_sales: ยอดขายสะสมรวมออเดอร์นี้
            total_orders: จำนวนออเดอร์สะสมรวมออเดอร์นี้
            product_info: ข้อมูลสินค้าจาก extract_product_info
            
        Returns:
            Dict ที่มีข้อมูล: commission, rate, bonus, special_bonus, 
                             is_special_rate, count_as_order
        """
        commission = 0
        rate = 0
        bonus = 0
        special_bonus = 0
        is_special_rate = False
        count_as_order = True
        
        # ตรวจสอบว่านับเป็นออเดอร์หรือไม่
        if product_info["is_perfume"] and not product_info["vase_count"]:
            # น้ำหอมอย่างเดียวไม่นับเป็นออเดอร์
            count_as_order = False
        
        # ตรวจสอบว่ายอดขายถึงขั้นต่ำหรือไม่
        if total_sales < 20000:
            return {
                "commission": 0,
                "rate": 0,
                "bonus": 0,
                "special_bonus": 0,
                "is_special_rate": False,
                "count_as_order": count_as_order,
                "reason": "ยอดขายยังไม่ถึง 20,000 บาท"
            }
        
        # คำนวณเรทคอมมิชชั่นหลัก
        for tier in CommissionCalculator.COMMISSION_TIERS:
            if total_sales >= tier["min"]:
                rate = tier["rate"]
                # ตรวจสอบโบนัสออเดอร์
                if total_orders >= tier["bonus_orders"]:
                    bonus = tier["bonus_amount"]
                break
        
        # ตรวจสอบคอมมิชชั่นพิเศษ 5%
        use_special_rate = False
        
        # 1. แจกัน Ikebana Curve
        if product_info["is_ikebana_curve"]:
            use_special_rate = True
        
        # 2. ชุดดอกไม้อย่างเดียว (ราคา >= 8000)
        elif product_info["is_flower_only"] and order_amount >= CommissionCalculator.MIN_FLOWER_ONLY_PRICE:
            use_special_rate = True
        
        # คำนวณคอมมิชชั่นจากยอดขาย
        if use_special_rate:
            commission = order_amount * CommissionCalculator.SPECIAL_COMMISSION_RATE
            is_special_rate = True
        else:
            commission = order_amount * rate
        
        # โบนัสแจกัน 2 ใบขึ้นไป
        if product_info["vase_count"] >= 2 and order_amount >= CommissionCalculator.MIN_VASE_PRICE:
            special_bonus = CommissionCalculator.MULTI_VASE_BONUS
        
        # รวมคอมมิชชั่นทั้งหมด
        total_commission = commission + special_bonus
        
        return {
            "commission": total_commission,
            "base_commission": commission,
            "rate": CommissionCalculator.SPECIAL_COMMISSION_RATE if use_special_rate else rate,
            "bonus": bonus,
            "special_bonus": special_bonus,
            "is_special_rate": is_special_rate,
            "count_as_order": count_as_order,
            "vase_count": product_info["vase_count"]
        }
    
    @staticmethod
    def get_current_tier(total_sales: float) -> Optional[Dict]:
        """
        หาเรทคอมมิชชั่นปัจจุบันตามยอดขาย
        
        Args:
            total_sales: ยอดขายสะสม
            
        Returns:
            Dict ของ tier หรือ None
        """
        for tier in CommissionCalculator.COMMISSION_TIERS:
            if total_sales >= tier["min"]:
                return tier
        return None
