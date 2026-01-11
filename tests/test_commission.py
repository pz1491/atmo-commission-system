"""
สคริปต์ทดสอบระบบคำนวณคอมมิชชั่น
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.commission_calculator import CommissionCalculator
from src.database import Database


def test_extract_amount():
    """ทดสอบการดึงยอดเงิน"""
    print("=" * 50)
    print("ทดสอบการดึงยอดเงิน")
    print("=" * 50)
    
    test_cases = [
        ("3,000 บาท", 3000),
        ("15000", 15000),
        ("ยอด 25,500 บาท", 25500),
        ("ราคา 4500", 4500),
    ]
    
    for text, expected in test_cases:
        result = CommissionCalculator.extract_amount(text)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{text}' -> {result} (คาดหวัง: {expected})")


def test_extract_product_info():
    """ทดสอบการแยกวิเคราะห์ข้อมูลสินค้า"""
    print("\n" + "=" * 50)
    print("ทดสอบการแยกวิเคราะห์ข้อมูลสินค้า")
    print("=" * 50)
    
    # ตัวอย่างข้อความจริง
    order_text = """1. Mini vaseทิวลิปส้ม 1
3,000 13:40 bay 10/01
คุณ สลิลเกตน์ โลกะวิทย์
2882/660 คอนโดศุภาลัยปาร์ค เอกมัย-ทองหล่อ
ถนนเพชรบุรีตัดใหม่ แขวงบางกะปิ เขตห้วยขวาง
กทม. 10310
โทร. 0898113968"""
    
    info = CommissionCalculator.extract_product_info(order_text)
    print(f"\nข้อความ: {order_text[:50]}...")
    print(f"ชื่อสินค้า: {info['product_name']}")
    print(f"ยอดเงิน: {info['amount']}")
    print(f"Mini vase: {info['is_mini_vase']}")
    print(f"น้ำหอม: {info['is_perfume']}")
    print(f"Ikebana Curve: {info['is_ikebana_curve']}")
    print(f"ดอกไม้อย่างเดียว: {info['is_flower_only']}")
    print(f"จำนวนแจกัน: {info['vase_count']}")


def test_commission_calculation():
    """ทดสอบการคำนวณคอมมิชชั่น"""
    print("\n" + "=" * 50)
    print("ทดสอบการคำนวณคอมมิชชั่น")
    print("=" * 50)
    
    calculator = CommissionCalculator()
    
    # Test case 1: ยอดยังไม่ถึง 20,000
    print("\n--- Test 1: ยอดยังไม่ถึง 20,000 ---")
    product_info = {"is_mini_vase": False, "is_perfume": False, "is_ikebana_curve": False, 
                   "is_flower_only": False, "vase_count": 1}
    result = calculator.calculate_commission(5000, 15000, 3, product_info)
    print(f"ยอดขาย: 5,000 | ยอดสะสม: 15,000 | ออเดอร์: 3")
    print(f"คอมมิชชั่น: {result['commission']} บาท (คาดหวัง: 0)")
    
    # Test case 2: ยอด 20,000-49,999 (1%)
    print("\n--- Test 2: ยอด 20,000-49,999 (1%) ---")
    result = calculator.calculate_commission(10000, 25000, 3, product_info)
    print(f"ยอดขาย: 10,000 | ยอดสะสม: 25,000 | ออเดอร์: 3")
    print(f"คอมมิชชั่น: {result['commission']} บาท (คาดหวัง: 100)")
    print(f"เรท: {result['rate']*100}% | โบนัส: {result['bonus']}")
    
    # Test case 3: ยอด 50,000+ (2%)
    print("\n--- Test 3: ยอด 50,000+ (2%) ---")
    result = calculator.calculate_commission(10000, 55000, 6, product_info)
    print(f"ยอดขาย: 10,000 | ยอดสะสม: 55,000 | ออเดอร์: 6")
    print(f"คอมมิชชั่น: {result['commission']} บาท (คาดหวัง: 200)")
    print(f"เรท: {result['rate']*100}% | โบนัส: {result['bonus']}")
    
    # Test case 4: Ikebana Curve (5%)
    print("\n--- Test 4: Ikebana Curve (5%) ---")
    product_info_special = {"is_mini_vase": False, "is_perfume": False, "is_ikebana_curve": True, 
                           "is_flower_only": False, "vase_count": 1}
    result = calculator.calculate_commission(8000, 30000, 3, product_info_special)
    print(f"ยอดขาย: 8,000 | ยอดสะสม: 30,000 | ออเดอร์: 3")
    print(f"คอมมิชชั่น: {result['commission']} บาท (คาดหวัง: 400)")
    print(f"เรท: {result['rate']*100}% | พิเศษ: {result['is_special_rate']}")
    
    # Test case 5: แจกัน 2 ใบ (+500)
    print("\n--- Test 5: แจกัน 2 ใบ (+500) ---")
    product_info_multi = {"is_mini_vase": False, "is_perfume": False, "is_ikebana_curve": False, 
                         "is_flower_only": False, "vase_count": 2}
    result = calculator.calculate_commission(10000, 30000, 3, product_info_multi)
    print(f"ยอดขาย: 10,000 | ยอดสะสม: 30,000 | ออเดอร์: 3 | แจกัน: 2")
    print(f"คอมมิชชั่น: {result['commission']} บาท (คาดหวัง: 100 + 500 = 600)")
    print(f"เรท: {result['rate']*100}% | โบนัสแจกัน: {result['special_bonus']}")


def test_database():
    """ทดสอบฐานข้อมูล"""
    print("\n" + "=" * 50)
    print("ทดสอบฐานข้อมูล")
    print("=" * 50)
    
    # สร้าง database ทดสอบ
    db = Database(data_dir="../data_test")
    
    # รีเซ็ตข้อมูล
    db.reset_data()
    print("✅ รีเซ็ตข้อมูลสำเร็จ")
    
    # เพิ่มออเดอร์
    product_info = {"vase_count": 1}
    commission_info = {
        "commission": 100,
        "base_commission": 100,
        "special_bonus": 0,
        "rate": 0.01,
        "is_special_rate": False,
        "count_as_order": True,
        "bonus": 0
    }
    
    summary = db.add_order(5000, "แจกันทดสอบ", commission_info, product_info)
    print(f"✅ เพิ่มออเดอร์สำเร็จ: ยอดรวม {summary['total_sales']} บาท")
    
    # ดึงข้อมูลสรุป
    summary = db.get_summary()
    print(f"✅ ดึงข้อมูลสรุป: {summary}")


if __name__ == "__main__":
    test_extract_amount()
    test_extract_product_info()
    test_commission_calculation()
    test_database()
    
    print("\n" + "=" * 50)
    print("✅ ทดสอบเสร็จสิ้น")
    print("=" * 50)
