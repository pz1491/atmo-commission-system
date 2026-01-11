# Bug Fix: 503 Service Unavailable Error

## ปัญหาที่พบ

หลังจาก deploy บน Google Cloud Run สำเร็จ แต่เมื่อเข้าถึง URL หรือตั้งค่า LINE Webhook ได้ error:

```
503 Service Unavailable
The webhook returned an HTTP status code other than 200.(503 Service Unavailable)
```

## สาเหตุ

จาก logs พบว่า:

```
ValueError: กรุณาตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_CHANNEL_SECRET ใน .env
```

**ปัญหา:** app.py ตรวจสอบว่าต้องมี environment variables แต่ยังไม่ได้ตั้งค่าบน Cloud Run

## การแก้ไข

### ขั้นตอนที่ 1: สร้าง Secrets

```bash
# สร้าง secret สำหรับ LINE Channel Access Token
echo "YOUR_LINE_CHANNEL_ACCESS_TOKEN" | gcloud secrets create line-channel-access-token --data-file=-

# สร้าง secret สำหรับ LINE Channel Secret
echo "YOUR_LINE_CHANNEL_SECRET" | gcloud secrets create line-channel-secret --data-file=-
```

**หมายเหตุ:** แทนที่ `YOUR_LINE_CHANNEL_ACCESS_TOKEN` และ `YOUR_LINE_CHANNEL_SECRET` ด้วยค่าจริงจาก LINE Developers Console

### ขั้นตอนที่ 2: Deploy พร้อม Secrets

```bash
cd /path/to/atmo-commission-system

gcloud run deploy atmo-commission \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest
```

หรือใช้ script:

```bash
./setup-secrets.sh
./deploy-gcp.sh
```

## ทดสอบ

### 1. ตรวจสอบว่า service รันได้

```bash
curl https://YOUR_CLOUD_RUN_URL/
```

**ผลลัพธ์ที่คาดหวัง:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>ระบบคำนวณคอมมิชชั่น ATMO'decor</title>
    ...
</head>
<body>
    <h1>ระบบคำนวณคอมมิชชั่น ATMO'decor</h1>
    <p>ระบบพร้อมใช้งาน</p>
    ...
</body>
</html>
```

### 2. ตรวจสอบ logs

```bash
gcloud alpha run services logs tail atmo-commission --region asia-southeast1
```

**ผลลัพธ์ที่คาดหวัง:**
- ไม่มี error
- เห็น "Starting gunicorn"
- เห็น "Listening at: http://0.0.0.0:8080"

### 3. ตั้งค่า LINE Webhook

1. ไปที่ https://developers.line.biz/console/
2. เลือก Channel ของคุณ
3. ไปที่ Messaging API settings
4. ตั้งค่า Webhook URL:
   ```
   https://YOUR_CLOUD_RUN_URL/callback
   ```
5. คลิก "Verify" เพื่อทดสอบ
6. เปิดใช้งาน "Use webhook"

**ผลลัพธ์ที่คาดหวัง:**
- ✅ Webhook verification สำเร็จ
- ✅ สามารถส่งข้อความถึง Bot ได้

## การตรวจสอบเพิ่มเติม

### ดู secrets ที่ตั้งค่าไว้

```bash
# ดูรายการ secrets
gcloud secrets list

# ดูว่า secret ถูกใช้ใน service หรือไม่
gcloud run services describe atmo-commission --region asia-southeast1 --format="value(spec.template.spec.containers[0].env)"
```

### ดูค่า secret (ถ้าจำเป็น)

```bash
gcloud secrets versions access latest --secret=line-channel-access-token
gcloud secrets versions access latest --secret=line-channel-secret
```

### อัพเดท secret (ถ้าต้องการเปลี่ยนค่า)

```bash
echo "NEW_VALUE" | gcloud secrets versions add line-channel-access-token --data-file=-
```

แล้ว deploy ใหม่:

```bash
gcloud run deploy atmo-commission \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-secrets=LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest
```

## สาเหตุที่พบบ่อย

### 1. Secret ไม่ได้สร้าง

**อาการ:**
```
ValueError: กรุณาตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_CHANNEL_SECRET ใน .env
```

**แก้ไข:**
- สร้าง secrets ตามขั้นตอนที่ 1
- Deploy ใหม่พร้อม `--set-secrets`

### 2. Secret ชื่อผิด

**อาการ:**
```
ERROR: (gcloud.run.deploy) Secret [line-channel-access-token] not found
```

**แก้ไข:**
- ตรวจสอบชื่อ secret: `gcloud secrets list`
- ตรวจสอบว่าใช้ชื่อเดียวกันใน `--set-secrets`

### 3. Permission ไม่เพียงพอ

**อาการ:**
```
ERROR: (gcloud.run.deploy) Permission denied
```

**แก้ไข:**
```bash
# ให้สิทธิ์ Cloud Run service account เข้าถึง secrets
gcloud secrets add-iam-policy-binding line-channel-access-token \
  --member=serviceAccount:441216662658-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding line-channel-secret \
  --member=serviceAccount:441216662658-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### 4. Dockerfile ถูก ignore

**อาการ:**
```
Build failed; check build logs for details
```

**แก้ไข:**
- ตรวจสอบ `.gcloudignore` ว่าไม่ได้บล็อก `Dockerfile`
- ลบบรรทัด `Dockerfile` ออกจาก `.gcloudignore`

## ผลลัพธ์หลังแก้ไข

- ✅ Service รันได้ปกติ
- ✅ curl ได้ response HTML
- ✅ LINE Webhook verification สำเร็จ
- ✅ Bot ตอบกลับได้เมื่อส่งข้อความ

## คำแนะนำเพิ่มเติม

### ใช้ Secret Manager แทน Environment Variables

**ข้อดี:**
- ปลอดภัยกว่า (encrypted at rest)
- จัดการง่าย (version control)
- ไม่ต้อง redeploy เมื่อเปลี่ยนค่า (บางกรณี)

**วิธีใช้:**
```bash
# ใน app.py
import os
from google.cloud import secretmanager

def get_secret(secret_id):
    client = secretmanager.SecretManagerServiceClient()
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode('UTF-8')

# ใช้งาน
LINE_CHANNEL_ACCESS_TOKEN = get_secret('line-channel-access-token')
LINE_CHANNEL_SECRET = get_secret('line-channel-secret')
```

แต่วิธีปัจจุบัน (ใช้ `--set-secrets`) ง่ายกว่าและเพียงพอสำหรับ use case นี้

---

**Updated:** 2026-01-11
**Status:** ✅ Fixed
**Related Issues:** #503, #env-vars
