# -*- coding: utf-8 -*-
"""
สคริปต์ทดสอบระบบคำนวณคอมมิชชั่น Version 2.0
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src import commission_calculator
from src.database import SalesDatabase

def test_commission_calculation():
    """ทดสอบการคำนวณคอมมิชชั่น"""
    print("=" * 60)
    print("ทดสอบการคำนวณคอมมิชชั่น")
    print("=" * 60)
    
    # Test Case 1: ยอดต่ำกว่า 25,000 (ไม่ได้คอมมิชชั่น)
    print("\nTest 1: ยอด 20,000 บาท (ต่ำกว่าขั้นต่ำ)")
    result = commission_calculator.calculate_order_commission(
        amount=20000,
        product_name="แจกันดอกไม้",
        total_sales=20000,
        is_two_vases=False
    )
    print(f"  Commission 1%: {result['commission_1']:.2f} บาท")
    print(f"  Commission 5%: {result['commission_5']:.2f} บาท")
    print(f"  Expected: 0 บาท (ยอดต่ำกว่า 25,000)")
    assert result['commission_1'] == 0, "Test 1 Failed!"
    print("  ✅ Pass")
    
    # Test Case 2: ยอด 25,000-49,999 (1%)
    print("\nTest 2: ยอด 30,000 บาท (เรท 1%)")
    result = commission_calculator.calculate_order_commission(
        amount=10000,
        product_name="แจกันดอกไม้",
        total_sales=30000,
        is_two_vases=False
    )
    print(f"  Commission 1%: {result['commission_1']:.2f} บาท")
    print(f"  Expected: 100 บาท (10,000 * 1%)")
    assert result['commission_1'] == 100, "Test 2 Failed!"
    print("  ✅ Pass")
    
    # Test Case 3: ยอด 50,000+ (2%)
    print("\nTest 3: ยอด 60,000 บาท (เรท 2%)")
    result = commission_calculator.calculate_order_commission(
        amount=10000,
        product_name="แจกันดอกไม้",
        total_sales=60000,
        is_two_vases=False
    )
    print(f"  Commission 1%: {result['commission_1']:.2f} บาท")
    print(f"  Expected: 200 บาท (10,000 * 2%)")
    assert result['commission_1'] == 200, "Test 3 Failed!"
    print("  ✅ Pass")
    
    # Test Case 4: ยอด 100,000+ (3%)
    print("\nTest 4: ยอด 110,000 บาท (เรท 3%)")
    result = commission_calculator.calculate_order_commission(
        amount=10000,
        product_name="แจกันดอกไม้",
        total_sales=110000,
        is_two_vases=False
    )
    print(f"  Commission 1%: {result['commission_1']:.2f} บาท")
    print(f"  Expected: 300 บาท (10,000 * 3%)")
    assert result['commission_1'] == 300, "Test 4 Failed!"
    print("  ✅ Pass")
    
    # Test Case 5: ยอด 180,000+ (4%)
    print("\nTest 5: ยอด 190,000 บาท (เรท 4%)")
    result = commission_calculator.calculate_order_commission(
        amount=10000,
        product_name="แจกันดอกไม้",
        total_sales=190000,
        is_two_vases=False
    )
    print(f"  Commission 1%: {result['commission_1']:.2f} บาท")
    print(f"  Expected: 400 บาท (10,000 * 4%)")
    assert result['commission_1'] == 400, "Test 5 Failed!"
    print("  ✅ Pass")
    
    # Test Case 6: คอมมิชชั่น 5% (Ikebana Curve)
    print("\nTest 6: Ikebana Curve 10,000 บาท (เรท 5%)")
    result = commission_calculator.calculate_order_commission(
        amount=10000,
        product_name="Ikebana Curve",
        total_sales=110000,
        is_two_vases=False
    )
    print(f"  Commission 5%: {result['commission_5']:.2f} บาท")
    print(f"  Expected: 500 บาท (10,000 * 5%)")
    assert result['commission_5'] == 500, "Test 6 Failed!"
    print("  ✅ Pass")
    
    # Test Case 7: Add on (2vases) - ยอด ≤ 9,500
    print("\nTest 7: แจกัน 2 ใบ ยอด 8,000 บาท (Add on +500)")
    result = commission_calculator.calculate_order_commission(
        amount=8000,
        product_name="แจกันดอกไม้ 2 ใบ",
        total_sales=108000,
        is_two_vases=True
    )
    print(f"  Add on (2vases): {result['add_on_2vases']:.2f} บาท")
    print(f"  Expected: 500 บาท")
    assert result['add_on_2vases'] == 500, "Test 7 Failed!"
    print("  ✅ Pass")
    
    # Test Case 8: Add on (2vases) - ยอด > 9,500
    print("\nTest 8: แจกัน 2 ใบ ยอด 10,000 บาท (Add on +300)")
    result = commission_calculator.calculate_order_commission(
        amount=10000,
        product_name="แจกันดอกไม้ 2 ใบ",
        total_sales=110000,
        is_two_vases=True
    )
    print(f"  Add on (2vases): {result['add_on_2vases']:.2f} บาท")
    print(f"  Expected: 300 บาท")
    assert result['add_on_2vases'] == 300, "Test 8 Failed!"
    print("  ✅ Pass")


def test_order_bonus():
    """ทดสอบโบนัสออเดอร์"""
    print("\n" + "=" * 60)
    print("ทดสอบโบนัสออเดอร์")
    print("=" * 60)
    
    test_cases = [
        (2, 0, "2 ออเดอร์"),
        (3, 100, "3 ออเดอร์"),
        (5, 100, "5 ออเดอร์"),
        (6, 400, "6 ออเดอร์"),
        (8, 800, "8 ออเดอร์"),
        (12, 1500, "12 ออเดอร์"),
    ]
    
    for orders, expected, desc in test_cases:
        result = commission_calculator.calculate_order_bonus(orders)
        print(f"\n{desc}: {result} บาท (Expected: {expected})")
        assert result == expected, f"Test Failed for {desc}!"
        print("  ✅ Pass")


def test_ot_penalty():
    """ทดสอบ OT Penalty"""
    print("\n" + "=" * 60)
    print("ทดสอบ OT Penalty")
    print("=" * 60)
    
    # Test Case 1: ยอด 18:00-22:00 ≥ 5,000 (ไม่หัก)
    print("\nTest 1: ยอด 18:00-22:00 = 6,000 บาท (ไม่หัก)")
    penalty = commission_calculator.calculate_ot_penalty(1000, 6000)
    print(f"  Penalty: {penalty:.2f} บาท")
    print(f"  Expected: 0 บาท")
    assert penalty == 0, "Test 1 Failed!"
    print("  ✅ Pass")
    
    # Test Case 2: ยอด 18:00-22:00 < 5,000 (หัก 30%)
    print("\nTest 2: ยอด 18:00-22:00 = 3,000 บาท, คอมมิชชั่น 1,000 บาท (หัก 30%)")
    penalty = commission_calculator.calculate_ot_penalty(1000, 3000)
    print(f"  Penalty: {penalty:.2f} บาท")
    print(f"  Expected: 300 บาท (1,000 * 30%)")
    assert penalty == 300, "Test 2 Failed!"
    print("  ✅ Pass")
    
    # Test Case 3: ยอด 18:00-22:00 < 5,000, คอมมิชชั่นสูง (หักสูงสุด 300)
    print("\nTest 3: ยอด 18:00-22:00 = 2,000 บาท, คอมมิชชั่น 1,500 บาท (หักสูงสุด 300)")
    penalty = commission_calculator.calculate_ot_penalty(1500, 2000)
    print(f"  Penalty: {penalty:.2f} บาท")
    print(f"  Expected: 300 บาท (สูงสุด)")
    assert penalty == 300, "Test 3 Failed!"
    print("  ✅ Pass")


def test_incentive_per_person():
    """ทดสอบการแบ่งคอมมิชชั่นตามจำนวนคน"""
    print("\n" + "=" * 60)
    print("ทดสอบการแบ่งคอมมิชชั่นตามจำนวนคน")
    print("=" * 60)
    
    test_cases = [
        (1000, 2, 500, "2 คน"),
        (1500, 3, 500, "3 คน"),
        (2000, 4, 500, "4 คน"),
    ]
    
    for total, staff_count, expected, desc in test_cases:
        result = commission_calculator.calculate_incentive_per_person(total, staff_count)
        print(f"\nคอมมิชชั่น {total} บาท / {desc}: {result:.2f} บาท")
        print(f"  Expected: {expected:.2f} บาท")
        assert abs(result - expected) < 0.01, f"Test Failed for {desc}!"
        print("  ✅ Pass")


def test_database():
    """ทดสอบการทำงานของฐานข้อมูล"""
    print("\n" + "=" * 60)
    print("ทดสอบการทำงานของฐานข้อมูล")
    print("=" * 60)
    
    # สร้าง database ทดสอบ
    db = SalesDatabase(data_dir="data_test")
    
    # Test 1: เริ่มต้นวัน
    print("\nTest 1: เริ่มต้นวัน")
    db.start_day("2026-01-11", 2, ["Oil", "Fang"])
    assert db.is_day_started() == True, "Test 1 Failed!"
    assert db.get_date() == "2026-01-11", "Test 1 Failed!"
    print("  ✅ Pass")
    
    # Test 2: เพิ่มออเดอร์
    print("\nTest 2: เพิ่มออเดอร์")
    db.add_order(
        order_id=1,
        amount=30000,
        product_name="แจกันดอกไม้",
        time="13:40",
        commission_1=300,
        commission_5=0,
        add_on_2vases=0,
        is_special=False,
        count_as_order=True
    )
    summary = db.get_summary()
    assert summary["total_sales"] == 30000, "Test 2 Failed!"
    assert summary["total_orders"] == 1, "Test 2 Failed!"
    print("  ✅ Pass")
    
    # Test 3: อัพเดทยอดรวม
    print("\nTest 3: อัพเดทยอดรวม")
    db.update_totals(100, 0, 400, 200)
    summary = db.get_summary()
    assert summary["add_on_order"] == 100, "Test 3 Failed!"
    assert summary["commission_total"] == 400, "Test 3 Failed!"
    assert summary["incentive_per_person"] == 200, "Test 3 Failed!"
    print("  ✅ Pass")
    
    # ลบโฟลเดอร์ทดสอบ
    import shutil
    shutil.rmtree("data_test", ignore_errors=True)
    print("\n✅ ทดสอบฐานข้อมูลสำเร็จ")


if __name__ == "__main__":
    print("\n🧪 เริ่มทดสอบระบบ ATMO'decor v2.0\n")
    
    try:
        test_commission_calculation()
        test_order_bonus()
        test_ot_penalty()
        test_incentive_per_person()
        test_database()
        
        print("\n" + "=" * 60)
        print("✅ ทดสอบทั้งหมดผ่าน!")
        print("=" * 60)
        print("\nระบบพร้อมใช้งาน! 🚀\n")
    except AssertionError as e:
        print(f"\n❌ การทดสอบล้มเหลว: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ เกิดข้อผิดพลาด: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
