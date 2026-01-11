"""
โมดูลจัดการฐานข้อมูลสำหรับเก็บข้อมูลยอดขายและออเดอร์
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional


class Database:
    """คลาสสำหรับจัดการข้อมูลในรูปแบบ JSON file"""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.data_file = os.path.join(data_dir, "sales_data.json")
        self._ensure_data_dir()
        self._load_or_create_data()
    
    def _ensure_data_dir(self):
        """สร้างโฟลเดอร์ data ถ้ายังไม่มี"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def _load_or_create_data(self):
        """โหลดข้อมูลจากไฟล์ หรือสร้างใหม่ถ้าไม่มี"""
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
        else:
            self.data = self._create_empty_data()
            self._save_data()
    
    def _create_empty_data(self) -> Dict:
        """สร้างโครงสร้างข้อมูลเริ่มต้น"""
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "total_sales": 0,
            "total_orders": 0,
            "commission_total": 0,
            "bonus_total": 0,
            "orders": []
        }
    
    def _save_data(self):
        """บันทึกข้อมูลลงไฟล์"""
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
    
    def check_and_reset_if_new_day(self) -> bool:
        """
        ตรวจสอบว่าเป็นวันใหม่หรือไม่ ถ้าใช่ให้รีเซ็ตข้อมูล
        
        Returns:
            True ถ้ามีการรีเซ็ต, False ถ้าไม่มี
        """
        today = datetime.now().strftime("%Y-%m-%d")
        if self.data["date"] != today:
            # บันทึกข้อมูลเก่าก่อนรีเซ็ต
            self._archive_old_data()
            # รีเซ็ตข้อมูล
            self.data = self._create_empty_data()
            self._save_data()
            return True
        return False
    
    def _archive_old_data(self):
        """บันทึกข้อมูลเก่าไปยังไฟล์ archive"""
        archive_file = os.path.join(
            self.data_dir, 
            f"archive_{self.data['date']}.json"
        )
        with open(archive_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
    
    def add_order(
        self,
        amount: float,
        product_name: str,
        commission_info: Dict,
        product_info: Dict
    ) -> Dict:
        """
        เพิ่มออเดอร์ใหม่
        
        Args:
            amount: ยอดขาย
            product_name: ชื่อสินค้า
            commission_info: ข้อมูลคอมมิชชั่นจาก calculate_commission
            product_info: ข้อมูลสินค้าจาก extract_product_info
            
        Returns:
            Dict ข้อมูลสรุปหลังเพิ่มออเดอร์
        """
        # ตรวจสอบและรีเซ็ตถ้าเป็นวันใหม่
        self.check_and_reset_if_new_day()
        
        # สร้างข้อมูลออเดอร์
        order = {
            "order_id": len(self.data["orders"]) + 1,
            "amount": amount,
            "product_name": product_name,
            "commission": commission_info["commission"],
            "base_commission": commission_info.get("base_commission", 0),
            "special_bonus": commission_info.get("special_bonus", 0),
            "rate": commission_info["rate"],
            "is_special_rate": commission_info.get("is_special_rate", False),
            "count_as_order": commission_info.get("count_as_order", True),
            "vase_count": product_info.get("vase_count", 0),
            "timestamp": datetime.now().isoformat()
        }
        
        # เพิ่มออเดอร์
        self.data["orders"].append(order)
        
        # อัพเดทยอดรวม
        self.data["total_sales"] += amount
        if commission_info.get("count_as_order", True):
            self.data["total_orders"] += 1
        self.data["commission_total"] += commission_info["commission"]
        self.data["bonus_total"] += commission_info.get("bonus", 0)
        
        # บันทึกข้อมูล
        self._save_data()
        
        return self.get_summary()
    
    def get_summary(self) -> Dict:
        """
        ดึงข้อมูลสรุปวันนี้
        
        Returns:
            Dict ข้อมูลสรุป
        """
        return {
            "date": self.data["date"],
            "total_sales": self.data["total_sales"],
            "total_orders": self.data["total_orders"],
            "commission_total": self.data["commission_total"],
            "bonus_total": self.data["bonus_total"],
            "order_count": len(self.data["orders"])
        }
    
    def get_all_orders(self) -> List[Dict]:
        """
        ดึงข้อมูลออเดอร์ทั้งหมดของวันนี้
        
        Returns:
            List ของออเดอร์
        """
        return self.data["orders"]
    
    def reset_data(self):
        """รีเซ็ตข้อมูลทั้งหมด (ใช้สำหรับทดสอบหรือรีเซ็ตด้วยตนเอง)"""
        self._archive_old_data()
        self.data = self._create_empty_data()
        self._save_data()
    
    def get_current_totals(self) -> tuple:
        """
        ดึงยอดรวมปัจจุบัน
        
        Returns:
            Tuple (total_sales, total_orders)
        """
        return (self.data["total_sales"], self.data["total_orders"])
