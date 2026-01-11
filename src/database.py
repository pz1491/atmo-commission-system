# -*- coding: utf-8 -*-
"""
โมดูลจัดการฐานข้อมูล ATMO'decor - Version 2.0
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import shutil


class SalesDatabase:
    """คลาสสำหรับจัดการข้อมูลยอดขายและคอมมิชชั่น"""
    
    def __init__(self, data_dir: str = "data"):
        """
        สร้าง instance ของ SalesDatabase
        
        Args:
            data_dir: โฟลเดอร์สำหรับเก็บข้อมูล
        """
        self.data_dir = data_dir
        self.data_file = os.path.join(data_dir, "sales_data.json")
        self.images_dir = os.path.join(data_dir, "images")
        
        # สร้างโฟลเดอร์ถ้ายังไม่มี
        os.makedirs(data_dir, exist_ok=True)
        os.makedirs(self.images_dir, exist_ok=True)
        
        # โหลดข้อมูล
        self.data = self._load_data()
    
    def _load_data(self) -> Dict:
        """โหลดข้อมูลจากไฟล์"""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return self._init_data()
        return self._init_data()
    
    def _init_data(self) -> Dict:
        """สร้างข้อมูลเริ่มต้น"""
        return {
            "date": None,
            "staff_count": 0,
            "staff_names": [],
            "total_sales": 0,
            "total_orders": 0,
            "sales_18_22": 0,
            "sales_22_00": 0,
            "orders": [],
            "commission_1_total": 0,
            "commission_5_total": 0,
            "add_on_2vases": 0,
            "add_on_order": 0,
            "ot_penalty": 0,
            "commission_total": 0,
            "incentive_per_person": 0,
            "is_started": False
        }
    
    def _save_data(self):
        """บันทึกข้อมูลลงไฟล์"""
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)
    
    def start_day(self, date: str, staff_count: int, staff_names: List[str]):
        """
        เริ่มต้นวันใหม่
        
        Args:
            date: วันที่ในรูปแบบ "YYYY-MM-DD"
            staff_count: จำนวนคนตอบ
            staff_names: รายชื่อคนตอบ
        """
        # ถ้ามีข้อมูลเก่า ให้สำรองก่อน
        if self.data.get("is_started") and self.data.get("total_sales", 0) > 0:
            self._archive_data()
        
        # รีเซ็ตข้อมูล
        self.data = self._init_data()
        self.data["date"] = date
        self.data["staff_count"] = staff_count
        self.data["staff_names"] = staff_names
        self.data["is_started"] = True
        
        # สร้างโฟลเดอร์สำหรับรูปภาพของวันนี้
        date_images_dir = os.path.join(self.images_dir, date)
        os.makedirs(date_images_dir, exist_ok=True)
        
        self._save_data()
    
    def is_day_started(self) -> bool:
        """ตรวจสอบว่าเริ่มต้นวันแล้วหรือยัง"""
        return self.data.get("is_started", False)
    
    def get_date(self) -> Optional[str]:
        """ดึงวันที่ปัจจุบัน"""
        return self.data.get("date")
    
    def add_order(
        self,
        order_id: int,
        amount: float,
        product_name: str,
        time: str,
        image_path: Optional[str] = None,
        note: str = "",
        commission_1: float = 0,
        commission_5: float = 0,
        add_on_2vases: float = 0,
        is_special: bool = False,
        count_as_order: bool = True
    ):
        """
        เพิ่มออเดอร์ใหม่
        
        Args:
            order_id: รหัสออเดอร์
            amount: ยอดเงิน
            product_name: ชื่อสินค้า
            time: เวลา
            image_path: path ของรูปภาพ
            note: หมายเหตุ
            commission_1: คอมมิชชั่น 1-4%
            commission_5: คอมมิชชั่น 5%
            add_on_2vases: Add on (2vases)
            is_special: เป็นสินค้าพิเศษหรือไม่
            count_as_order: นับเป็นออเดอร์หรือไม่
        """
        order = {
            "order_id": order_id,
            "amount": amount,
            "product_name": product_name,
            "time": time,
            "image_path": image_path,
            "note": note,
            "commission_1": commission_1,
            "commission_5": commission_5,
            "add_on_2vases": add_on_2vases,
            "is_special": is_special,
            "count_as_order": count_as_order
        }
        
        self.data["orders"].append(order)
        self.data["total_sales"] += amount
        
        if count_as_order:
            self.data["total_orders"] += 1
        
        # อัพเดทยอดขายตามช่วงเวลา
        if time:
            try:
                hour = int(time.split(':')[0])
                if 18 <= hour < 22:
                    self.data["sales_18_22"] += amount
                elif 22 <= hour < 24:
                    self.data["sales_22_00"] += amount
            except:
                pass
        
        # อัพเดทคอมมิชชั่น
        self.data["commission_1_total"] += commission_1
        self.data["commission_5_total"] += commission_5
        self.data["add_on_2vases"] += add_on_2vases
        
        self._save_data()
    
    def update_totals(
        self,
        add_on_order: float,
        ot_penalty: float,
        commission_total: float,
        incentive_per_person: float
    ):
        """
        อัพเดทยอดรวม
        
        Args:
            add_on_order: Add on (order)
            ot_penalty: OT Penalty
            commission_total: คอมมิชชั่นรวม
            incentive_per_person: Incentive ต่อคน
        """
        self.data["add_on_order"] = add_on_order
        self.data["ot_penalty"] = ot_penalty
        self.data["commission_total"] = commission_total
        self.data["incentive_per_person"] = incentive_per_person
        
        self._save_data()
    
    def get_summary(self) -> Dict:
        """ดึงข้อมูลสรุป"""
        return self.data.copy()
    
    def get_orders(self) -> List[Dict]:
        """ดึงรายการออเดอร์ทั้งหมด"""
        return self.data.get("orders", [])
    
    def get_order_images(self) -> List[str]:
        """ดึงรายการ path ของรูปภาพทั้งหมด"""
        images = []
        for order in self.data.get("orders", []):
            if order.get("image_path"):
                images.append(order["image_path"])
        return images
    
    def save_image(self, image_data: bytes, order_id: int) -> str:
        """
        บันทึกรูปภาพ
        
        Args:
            image_data: ข้อมูลรูปภาพ
            order_id: รหัสออเดอร์
            
        Returns:
            path ของรูปภาพที่บันทึก
        """
        date = self.data.get("date", datetime.now().strftime("%Y-%m-%d"))
        date_images_dir = os.path.join(self.images_dir, date)
        os.makedirs(date_images_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%H%M%S")
        filename = f"order_{order_id}_{timestamp}.jpg"
        filepath = os.path.join(date_images_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        return filepath
    
    def reset(self):
        """รีเซ็ตข้อมูลทั้งหมด"""
        # สำรองข้อมูลก่อนรีเซ็ต
        if self.data.get("total_sales", 0) > 0:
            self._archive_data()
        
        self.data = self._init_data()
        self._save_data()
    
    def _archive_data(self):
        """สำรองข้อมูลเก่า"""
        if not os.path.exists(self.data_file):
            return
        
        # สร้างโฟลเดอร์ archive ถ้ายังไม่มี
        archive_dir = os.path.join(self.data_dir, "archive")
        os.makedirs(archive_dir, exist_ok=True)
        
        # ตั้งชื่อไฟล์สำรอง
        date = self.data.get("date", datetime.now().strftime("%Y-%m-%d"))
        timestamp = datetime.now().strftime("%H%M%S")
        archive_file = os.path.join(archive_dir, f"sales_{date}_{timestamp}.json")
        
        # คัดลอกไฟล์
        try:
            shutil.copy2(self.data_file, archive_file)
            print(f"ข้อมูลถูกสำรองไว้ที่: {archive_file}")
        except Exception as e:
            print(f"ไม่สามารถสำรองข้อมูลได้: {e}")
