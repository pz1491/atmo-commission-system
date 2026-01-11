FROM python:3.11-slim

# ตั้งค่า working directory
WORKDIR /app

# คัดลอก requirements
COPY requirements.txt .

# ติดตั้ง dependencies
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอกโค้ดทั้งหมด
COPY . .

# สร้างโฟลเดอร์สำหรับเก็บข้อมูล
RUN mkdir -p /app/data /app/images

# Expose port
EXPOSE 8000

# รันแอปพลิเคชัน
CMD ["python", "app.py"]
