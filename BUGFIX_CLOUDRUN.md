# Bug Fix: Docker Build Error on Cloud Run

## ปัญหาที่พบ

```
ERROR: (gcloud.run.deploy) Build failed; check build logs for details
build step 0 "gcr.io/cloud-builders/docker" failed: step exited with non-zero status: 1
```

## สาเหตุ

1. **ไม่มี gunicorn** - Flask development server ไม่เหมาะสำหรับ production
2. **Port ไม่ถูกต้อง** - Cloud Run ใช้ PORT environment variable
3. **Debug mode เปิดอยู่** - ไม่ปลอดภัยใน production

## การแก้ไข

### 1. Dockerfile

**เดิม:**
```dockerfile
CMD ["python", "app.py"]
```

**ใหม่:**
```dockerfile
# Install gunicorn for production
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
```

**เพิ่มเติม:**
- ตั้ง `ENV PORT=8080`
- ตั้ง `ENV PYTHONUNBUFFERED=1`

### 2. requirements.txt

**เพิ่ม:**
```
gunicorn==21.2.0
```

### 3. app.py

**เดิม:**
```python
if __name__ == "__main__":
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
```

**ใหม่:**
```python
if __name__ == "__main__":
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
```

## วิธีใช้งาน

### Deploy ใหม่

```bash
cd /path/to/atmo-commission-system

# Pull การเปลี่ยนแปลงล่าสุด
git pull origin main

# Deploy
./deploy-gcp.sh
```

หรือ:

```bash
gcloud run deploy atmo-commission \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest
```

## ทดสอบ

### 1. ตรวจสอบว่า build สำเร็จ

```bash
# ดู build logs
gcloud builds list --limit=1

# ดูรายละเอียด
gcloud builds describe BUILD_ID
```

### 2. ตรวจสอบ service

```bash
# ดูสถานะ
gcloud run services describe atmo-commission --region asia-southeast1

# ทดสอบเข้าถึง
curl https://YOUR_URL/
```

### 3. ตรวจสอบ logs

```bash
# ดู logs แบบ real-time
gcloud run services logs tail atmo-commission --region asia-southeast1

# ดู logs ย้อนหลัง
gcloud run services logs read atmo-commission --region asia-southeast1 --limit=50
```

## คำอธิบายเพิ่มเติม

### ทำไมต้องใช้ gunicorn?

Flask development server (`python app.py`) ไม่เหมาะสำหรับ production:
- ไม่รองรับ concurrent requests ได้ดี
- ไม่มี process management
- ไม่มี graceful shutdown
- ประสิทธิภาพต่ำ

gunicorn เป็น WSGI HTTP Server ที่:
- รองรับ multiple workers และ threads
- มี graceful restart
- เหมาะสำหรับ production
- ใช้งานง่าย

### gunicorn Configuration

```bash
gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
```

**อธิบาย:**
- `--bind :$PORT` - bind กับ port ที่ Cloud Run กำหนด
- `--workers 1` - ใช้ 1 worker process (เพียงพอสำหรับ Cloud Run)
- `--threads 8` - ใช้ 8 threads ต่อ worker (รองรับ concurrent requests)
- `--timeout 0` - ไม่มี timeout (เหมาะสำหรับ webhook)
- `app:app` - module:application (app.py:app)

### ทำไมต้องตั้ง PYTHONUNBUFFERED=1?

เพื่อให้ Python output (print, logs) แสดงทันที ไม่ buffer
- ช่วยในการ debug
- ทำให้เห็น logs แบบ real-time

## ผลลัพธ์ที่คาดหวัง

หลังแก้ไข:
- ✅ Docker build สำเร็จ
- ✅ Deploy สำเร็จ
- ✅ Service รันได้
- ✅ Webhook ทำงานได้

## Troubleshooting

### ถ้ายัง build fail

1. ตรวจสอบ requirements.txt มี gunicorn
2. ตรวจสอบ Dockerfile syntax
3. ดู build logs แบบละเอียด:
   ```bash
   gcloud builds log BUILD_ID --region=asia-southeast1
   ```

### ถ้า deploy สำเร็จแต่ service ไม่ทำงาน

1. ตรวจสอบ logs:
   ```bash
   gcloud run services logs tail atmo-commission --region asia-southeast1
   ```

2. ตรวจสอบ environment variables:
   ```bash
   gcloud run services describe atmo-commission --region asia-southeast1
   ```

3. ตรวจสอบ secrets:
   ```bash
   gcloud secrets list
   gcloud secrets versions access latest --secret=line-channel-access-token
   ```

## สรุป

การแก้ไขนี้ทำให้:
- ✅ ระบบพร้อมสำหรับ production
- ✅ รองรับ concurrent requests
- ✅ ปลอดภัยกว่า (ปิด debug mode)
- ✅ ทำงานได้ดีบน Cloud Run

---

**Updated:** 2026-01-11
**Status:** ✅ Fixed
**GitHub Commit:** bc50ad5
