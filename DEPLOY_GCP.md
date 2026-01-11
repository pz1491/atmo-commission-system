# คู่มือการ Deploy ระบบคำนวณคอมมิชชั่น ATMO'decor บน Google Cloud Run

## 📋 สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [ข้อกำหนดเบื้องต้น](#ข้อกำหนดเบื้องต้น)
3. [ขั้นตอนการ Deploy](#ขั้นตอนการ-deploy)
4. [การตั้งค่า Webhook](#การตั้งค่า-webhook)
5. [การตรวจสอบและ Monitoring](#การตรวจสอบและ-monitoring)
6. [Troubleshooting](#troubleshooting)
7. [ค่าใช้จ่าย](#ค่าใช้จ่าย)

---

## ภาพรวม

**Google Cloud Run** เป็นบริการ serverless ที่เหมาะสำหรับ Deploy ระบบคำนวณคอมมิชชั่นนี้ เนื่องจาก:

- ✅ **Deploy ง่าย**: คำสั่งเดียวเสร็จ
- ✅ **Auto-scaling**: ปรับขนาดอัตโนมัติตาม traffic
- ✅ **ประหยัด**: จ่ายเฉพาะเวลาที่ใช้งาน (< $1/เดือนสำหรับ traffic น้อย)
- ✅ **HTTPS ฟรี**: มี SSL certificate อัตโนมัติ
- ✅ **Webhook-friendly**: เหมาะกับ LINE Official Account

---

## ข้อกำหนดเบื้องต้น

### 1. Google Cloud Account

สมัครที่: https://cloud.google.com/

**Free Tier ได้:**
- $300 credit สำหรับ 90 วันแรก
- Cloud Run: 2 ล้าน requests/เดือน (ฟรีตลอดไป)

### 2. ติดตั้ง Google Cloud CLI

**macOS:**
```bash
brew install google-cloud-sdk
```

**Windows:**
ดาวน์โหลดจาก: https://cloud.google.com/sdk/docs/install

**Linux:**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**ตรวจสอบการติดตั้ง:**
```bash
gcloud version
```

### 3. LINE Official Account

- Channel Access Token
- Channel Secret

ดูวิธีการได้ที่: https://developers.line.biz/console/

---

## ขั้นตอนการ Deploy

### ขั้นตอนที่ 1: เตรียม Google Cloud Project

```bash
# 1. Login
gcloud auth login

# 2. สร้าง project ใหม่ (หรือใช้ project ที่มีอยู่)
gcloud projects create atmo-commission-system --name="ATMO Commission System"

# 3. ตั้งค่า project
gcloud config set project atmo-commission-system

# 4. เปิดใช้งาน billing (จำเป็น)
# ไปที่: https://console.cloud.google.com/billing
# เลือก project และเชื่อม billing account

# 5. เปิดใช้งาน APIs ที่จำเป็น
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### ขั้นตอนที่ 2: Clone Repository

```bash
# Clone จาก GitHub
git clone https://github.com/pz1491/atmo-commission-system.git
cd atmo-commission-system
```

### ขั้นตอนที่ 3: สร้าง Secrets สำหรับ LINE Credentials

```bash
# สร้าง secret สำหรับ LINE Access Token
echo -n "YOUR_LINE_CHANNEL_ACCESS_TOKEN" | \
  gcloud secrets create line-access-token --data-file=-

# สร้าง secret สำหรับ LINE Channel Secret
echo -n "YOUR_LINE_CHANNEL_SECRET" | \
  gcloud secrets create line-channel-secret --data-file=-

# ตรวจสอบ secrets ที่สร้าง
gcloud secrets list
```

**หมายเหตุ:** แทนที่ `YOUR_LINE_CHANNEL_ACCESS_TOKEN` และ `YOUR_LINE_CHANNEL_SECRET` ด้วยค่าจริงจาก LINE Developers Console

### ขั้นตอนที่ 4: Deploy ไปยัง Cloud Run

```bash
# Deploy แบบ deploy from source (แนะนำ)
gcloud run deploy atmo-commission \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --platform managed \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --set-secrets="LINE_CHANNEL_ACCESS_TOKEN=line-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest"
```

**คำอธิบาย parameters:**
- `--source .`: Deploy จาก source code ในโฟลเดอร์ปัจจุบัน
- `--region asia-southeast1`: ใช้ region สิงคโปร์ (ใกล้ไทยที่สุด)
- `--allow-unauthenticated`: อนุญาตให้เข้าถึงได้โดยไม่ต้อง authentication (สำหรับ webhook)
- `--memory 512Mi`: จองหน่วยความจำ 512 MB
- `--cpu 1`: ใช้ 1 vCPU
- `--timeout 300`: timeout 300 วินาที (5 นาที)
- `--concurrency 80`: รับ request พร้อมกันได้ 80 requests ต่อ instance
- `--min-instances 0`: scale-to-zero เมื่อไม่มี traffic (ประหยัดค่าใช้จ่าย)
- `--max-instances 10`: สูงสุด 10 instances
- `--set-secrets`: เชื่อมต่อกับ Secret Manager

**ระหว่าง deploy จะถาม:**
1. Service name: กด Enter (ใช้ชื่อ `atmo-commission`)
2. Enable APIs: ตอบ `y`
3. Region: เลือก `asia-southeast1`
4. Allow public access: ตอบ `y`

**รอสักครู่... (ประมาณ 2-3 นาที)**

เมื่อเสร็จจะได้ URL เช่น:
```
Service URL: https://atmo-commission-xxxxxxxxxx-as.a.run.app
```

**บันทึก URL นี้ไว้!** จะใช้สำหรับตั้งค่า Webhook

---

## การตั้งค่า Webhook

### ขั้นตอนที่ 1: ตั้งค่า Webhook URL ใน LINE Developers

1. ไปที่ https://developers.line.biz/console/
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. ในส่วน **Webhook settings**:
   - Webhook URL: `https://YOUR_CLOUD_RUN_URL/webhook`
   - เปิดใช้งาน **Use webhook**
   - คลิก **Verify** เพื่อทดสอบ

**ตัวอย่าง:**
```
https://atmo-commission-xxxxxxxxxx-as.a.run.app/webhook
```

### ขั้นตอนที่ 2: ทดสอบระบบ

1. เพิ่ม LINE Bot เข้ากลุ่ม
2. ส่งคำสั่ง `/start` เพื่อเริ่มต้นวัน
3. ส่งข้อความออเดอร์ตามรูปแบบ:
   ```
   1.Visa Patanasin/fb
   
   แจกันลายมนกุหลาบขาว 4 ดอก 
   4580 11/1 kbank 15:27
   คุณ วิสาข์ พัฒนสิน
   ...
   ```
4. ระบบจะตอบกลับพร้อมสรุปคอมมิชชั่น

---

## การตรวจสอบและ Monitoring

### ดู Logs

```bash
# ดู logs แบบ real-time
gcloud run services logs tail atmo-commission --region asia-southeast1

# ดู logs ย้อนหลัง
gcloud run services logs read atmo-commission --region asia-southeast1 --limit 50
```

### ดูสถานะ Service

```bash
# ดูข้อมูล service
gcloud run services describe atmo-commission --region asia-southeast1

# ดู revisions
gcloud run revisions list --service atmo-commission --region asia-southeast1
```

### Monitoring ผ่าน Console

ไปที่: https://console.cloud.google.com/run

คุณจะเห็น:
- **Request count**: จำนวน requests
- **Request latency**: เวลาตอบสนอง
- **Container instance count**: จำนวน instances ที่ทำงาน
- **Billable container instance time**: เวลาที่คิดเงิน
- **Memory utilization**: การใช้หน่วยความจำ
- **CPU utilization**: การใช้ CPU

---

## การอัพเดทระบบ

### อัพเดทโค้ด

```bash
# 1. Pull โค้ดใหม่
git pull origin main

# 2. Deploy ใหม่
gcloud run deploy atmo-commission \
  --source . \
  --region asia-southeast1
```

### อัพเดท Secrets

```bash
# อัพเดท LINE Access Token
echo -n "NEW_TOKEN" | gcloud secrets versions add line-access-token --data-file=-

# อัพเดท LINE Channel Secret
echo -n "NEW_SECRET" | gcloud secrets versions add line-channel-secret --data-file=-

# Redeploy เพื่อใช้ secret ใหม่
gcloud run services update atmo-commission --region asia-southeast1
```

---

## Troubleshooting

### ปัญหา: Deploy ไม่สำเร็จ

**แก้ไข:**
```bash
# ตรวจสอบว่าเปิด APIs แล้ว
gcloud services list --enabled

# เปิด APIs ที่จำเป็น
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### ปัญหา: Webhook ไม่ทำงาน

**แก้ไข:**
1. ตรวจสอบ Webhook URL ใน LINE Developers
2. ตรวจสอบ logs:
   ```bash
   gcloud run services logs tail atmo-commission --region asia-southeast1
   ```
3. ตรวจสอบว่า service เป็น `--allow-unauthenticated`

### ปัญหา: ไม่สามารถเข้าถึง Secrets

**แก้ไข:**
```bash
# ให้สิทธิ์ Cloud Run เข้าถึง Secret Manager
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding line-access-token \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding line-channel-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### ปัญหา: Cold Start ช้า

**แก้ไข:**
```bash
# ตั้งค่า minimum instances = 1 (จะมีค่าใช้จ่ายเพิ่ม)
gcloud run services update atmo-commission \
  --region asia-southeast1 \
  --min-instances 1
```

---

## ค่าใช้จ่าย

### ประมาณการค่าใช้จ่าย

**สมมติฐาน:**
- Traffic: 1,000 requests/เดือน
- Average request time: 200ms
- Memory: 512 MB
- CPU: 1 vCPU

**การคำนวณ:**

1. **Requests**: 1,000 requests/เดือน
   - ฟรี (อยู่ใน free tier 2 ล้าน requests)

2. **CPU time**: 1,000 × 0.2s = 200 vCPU-seconds
   - ฟรี (อยู่ใน free tier 360,000 vCPU-seconds)

3. **Memory**: 1,000 × 0.2s × 0.5 GB = 100 GiB-seconds
   - ฟรี (อยู่ใน free tier 180,000 GiB-seconds)

**รวม: $0/เดือน** (อยู่ใน free tier)

### Free Tier ของ Cloud Run

- **Requests**: 2 ล้าน requests/เดือน
- **CPU time**: 360,000 vCPU-seconds/เดือน
- **Memory**: 180,000 GiB-seconds/เดือน
- **Network egress**: 1 GB/เดือน

### ตัวอย่างค่าใช้จ่ายเมื่อเกิน Free Tier

**Traffic สูง (10,000 requests/เดือน):**
- Requests: ฟรี (ยังอยู่ใน free tier)
- CPU: ฟรี (ยังอยู่ใน free tier)
- Memory: ฟรี (ยังอยู่ใน free tier)
- **รวม: $0/เดือน**

**Traffic สูงมาก (100,000 requests/เดือน):**
- Requests: ฟรี (ยังอยู่ใน free tier)
- CPU: ~$1-2/เดือน
- Memory: ~$0.5-1/เดือน
- **รวม: ~$1.5-3/เดือน**

### เปรียบเทียบกับ VPS

| Service | ค่าใช้จ่าย/เดือน | ข้อดี | ข้อเสีย |
|---------|------------------|-------|---------|
| **Cloud Run** | $0-3 | Auto-scaling, HTTPS ฟรี, ไม่ต้องดูแลเซิร์ฟเวอร์ | Cold start |
| **VPS (DigitalOcean)** | $6-12 | Full control | ต้องดูแลเอง, ไม่มี auto-scaling |
| **VPS (AWS EC2)** | $8-15 | Full control | ต้องดูแลเอง, ไม่มี auto-scaling |

---

## การลบ Service

หากต้องการลบ service:

```bash
# ลบ Cloud Run service
gcloud run services delete atmo-commission --region asia-southeast1

# ลบ secrets
gcloud secrets delete line-access-token
gcloud secrets delete line-channel-secret

# ลบ project (ถ้าต้องการ)
gcloud projects delete atmo-commission-system
```

---

## คำแนะนำเพิ่มเติม

### 1. ตั้งค่า Custom Domain (Optional)

```bash
# Map custom domain
gcloud run services update atmo-commission \
  --region asia-southeast1 \
  --add-custom-domain your-domain.com
```

### 2. ตั้งค่า Backup อัตโนมัติ

ข้อมูลจะถูกเก็บใน `/data` directory ภายใน container แต่จะหายเมื่อ container restart

**แนะนำ:** ใช้ Cloud Storage สำหรับ backup

```bash
# สร้าง bucket
gsutil mb gs://atmo-commission-backup

# Backup ข้อมูล (ทำด้วย cron job)
gsutil cp -r /data/* gs://atmo-commission-backup/
```

### 3. ตั้งค่า Alerting

ไปที่: https://console.cloud.google.com/monitoring

สร้าง alert policies สำหรับ:
- Error rate > 5%
- Request latency > 1s
- Memory utilization > 80%

---

## สรุป

คุณได้ Deploy ระบบคำนวณคอมมิชชั่น ATMO'decor บน Google Cloud Run เรียบร้อยแล้ว! 🎉

**ขั้นตอนหลัก:**
1. ✅ สร้าง Google Cloud Project
2. ✅ สร้าง Secrets สำหรับ LINE credentials
3. ✅ Deploy ด้วย `gcloud run deploy`
4. ✅ ตั้งค่า Webhook ใน LINE Developers
5. ✅ ทดสอบระบบ

**ประโยชน์:**
- ✅ ประหยัด (< $1/เดือน)
- ✅ Auto-scaling
- ✅ HTTPS ฟรี
- ✅ ไม่ต้องดูแลเซิร์ฟเวอร์

**หากมีปัญหา:**
- ดู [Troubleshooting](#troubleshooting)
- ตรวจสอบ logs: `gcloud run services logs tail atmo-commission`
- ดู monitoring: https://console.cloud.google.com/run

---

## ลิงก์ที่เป็นประโยชน์

- **Google Cloud Console**: https://console.cloud.google.com/
- **Cloud Run Documentation**: https://cloud.google.com/run/docs
- **LINE Developers**: https://developers.line.biz/console/
- **GitHub Repository**: https://github.com/pz1491/atmo-commission-system

---

**ขอให้ใช้งานสนุก!** 🌸
