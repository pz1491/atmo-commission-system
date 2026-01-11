# คู่มือการ Deploy ระบบคำนวณคอมมิชชั่น ATMO'decor

## 📋 ข้อกำหนดเบื้องต้น

### ฮาร์ดแวร์และซอฟต์แวร์
- **เซิร์ฟเวอร์**: VPS หรือ Cloud Server (Ubuntu 20.04+ แนะนำ)
- **RAM**: ขั้นต่ำ 512MB (แนะนำ 1GB+)
- **Storage**: ขั้นต่ำ 5GB
- **Docker**: เวอร์ชัน 20.10+
- **Docker Compose**: เวอร์ชัน 1.29+

### LINE Official Account
- Channel Access Token
- Channel Secret
- Webhook URL (จะได้หลัง Deploy)

---

## 🚀 วิธีการ Deploy

### 1. เตรียมเซิร์ฟเวอร์

```bash
# อัพเดทระบบ
sudo apt update && sudo apt upgrade -y

# ติดตั้ง Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# ติดตั้ง Docker Compose
sudo apt install docker-compose -y

# เพิ่ม user เข้า docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone Repository

```bash
# Clone จาก GitHub
git clone https://github.com/YOUR_USERNAME/atmo-commission-system.git
cd atmo-commission-system

# หรือ Upload ไฟล์ ZIP แล้วแตกไฟล์
unzip atmo-commission-system-v2.zip
cd line-commission-system
```

### 3. ตั้งค่า Environment Variables

```bash
# คัดลอกไฟล์ .env.example
cp .env.example .env

# แก้ไขไฟล์ .env
nano .env
```

แก้ไขค่าต่อไปนี้:
```env
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here
PORT=8000
```

### 4. สร้างโฟลเดอร์สำหรับเก็บข้อมูล

```bash
mkdir -p data images
chmod 755 data images
```

### 5. Build และรัน Docker Container

```bash
# Build image
docker-compose build

# รัน container
docker-compose up -d

# ตรวจสอบสถานะ
docker-compose ps
docker-compose logs -f
```

### 6. ตั้งค่า Webhook URL ใน LINE Developers

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Provider และ Channel
3. ไปที่แท็บ "Messaging API"
4. ตั้งค่า Webhook URL:
   ```
   https://your-server-domain.com/webhook
   ```
   หรือ
   ```
   http://your-server-ip:8000/webhook
   ```
5. กด "Verify" เพื่อทดสอบ
6. เปิดใช้งาน "Use webhook"

### 7. ตั้งค่า SSL (แนะนำ)

LINE ต้องการ HTTPS สำหรับ Webhook ใช้ Nginx + Let's Encrypt:

```bash
# ติดตั้ง Nginx
sudo apt install nginx -y

# ติดตั้ง Certbot
sudo apt install certbot python3-certbot-nginx -y

# สร้าง SSL Certificate
sudo certbot --nginx -d your-domain.com

# ตั้งค่า Nginx Reverse Proxy
sudo nano /etc/nginx/sites-available/atmo-commission
```

เพิ่มการตั้งค่า:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# เปิดใช้งาน
sudo ln -s /etc/nginx/sites-available/atmo-commission /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔧 การจัดการระบบ

### ตรวจสอบ Logs

```bash
# ดู logs แบบ real-time
docker-compose logs -f

# ดู logs 100 บรรทัดล่าสุด
docker-compose logs --tail=100

# ดู logs ของวันนี้
docker-compose logs --since $(date +%Y-%m-%d)
```

### รีสตาร์ทระบบ

```bash
# รีสตาร์ท
docker-compose restart

# หยุดและเริ่มใหม่
docker-compose down
docker-compose up -d
```

### อัพเดทระบบ

```bash
# Pull code ใหม่
git pull origin main

# Rebuild และรีสตาร์ท
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup ข้อมูล

```bash
# Backup ฐานข้อมูล
cp -r data data_backup_$(date +%Y%m%d)

# Backup รูปภาพ
cp -r images images_backup_$(date +%Y%m%d)

# สร้าง tar archive
tar -czf backup_$(date +%Y%m%d).tar.gz data images
```

---

## 🐛 การแก้ไขปัญหา

### ปัญหา: Container ไม่สามารถเริ่มได้

```bash
# ตรวจสอบ logs
docker-compose logs

# ตรวจสอบ port ว่าถูกใช้งานหรือไม่
sudo netstat -tulpn | grep 8000

# ลบ container และสร้างใหม่
docker-compose down
docker-compose up -d
```

### ปัญหา: LINE Webhook ไม่ทำงาน

1. ตรวจสอบว่า Webhook URL ถูกต้อง
2. ตรวจสอบว่าใช้ HTTPS (LINE ต้องการ HTTPS)
3. ตรวจสอบ Firewall:
   ```bash
   sudo ufw allow 8000/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```
4. ตรวจสอบ logs:
   ```bash
   docker-compose logs -f
   ```

### ปัญหา: ข้อมูลหายหลังรีสตาร์ท

ตรวจสอบว่า volumes ถูก mount ถูกต้อง:
```bash
docker-compose down
docker volume ls
docker-compose up -d
```

---

## 📊 การ Monitor

### ตรวจสอบ Resource Usage

```bash
# ดู CPU และ Memory
docker stats

# ดู Disk Usage
df -h
du -sh data/ images/
```

### ตั้งค่า Auto-restart

Docker Compose จะรีสตาร์ทอัตโนมัติถ้า container หยุดทำงาน (ตั้งค่าไว้แล้วใน `docker-compose.yml`)

---

## 🔐 ความปลอดภัย

### แนะนำ

1. **ใช้ HTTPS เสมอ** - LINE ต้องการ HTTPS สำหรับ Webhook
2. **เก็บ .env ไว้เป็นความลับ** - อย่า commit ลง GitHub
3. **ตั้งค่า Firewall** - เปิดเฉพาะ port ที่จำเป็น
4. **Backup ข้อมูลสม่ำเสมอ** - ตั้ง cron job สำหรับ backup อัตโนมัติ
5. **อัพเดท Docker และ Dependencies** - ตรวจสอบและอัพเดทเป็นประจำ

### ตั้งค่า Firewall

```bash
# เปิดใช้งาน UFW
sudo ufw enable

# อนุญาต SSH
sudo ufw allow ssh

# อนุญาต HTTP และ HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# อนุญาต port 8000 (ถ้าไม่ใช้ Nginx)
sudo ufw allow 8000/tcp

# ตรวจสอบสถานะ
sudo ufw status
```

---

## 📞 การติดต่อและสนับสนุน

หากพบปัญหาหรือต้องการความช่วยเหลือ:
- ตรวจสอบ logs: `docker-compose logs -f`
- อ่าน README.md และ CHANGELOG_V2.md
- ติดต่อผู้พัฒนา

---

## 📝 Checklist การ Deploy

- [ ] ติดตั้ง Docker และ Docker Compose
- [ ] Clone repository
- [ ] ตั้งค่า .env
- [ ] สร้างโฟลเดอร์ data และ images
- [ ] Build และรัน Docker container
- [ ] ตั้งค่า SSL (ถ้าใช้ HTTPS)
- [ ] ตั้งค่า Nginx Reverse Proxy (ถ้าใช้)
- [ ] ตั้งค่า Webhook URL ใน LINE Developers
- [ ] ทดสอบส่งข้อความใน LINE
- [ ] ตั้งค่า Firewall
- [ ] ตั้งค่า Backup อัตโนมัติ
- [ ] ตรวจสอบ logs และ monitoring

---

**หมายเหตุ**: คู่มือนี้เหมาะสำหรับการ Deploy บน Ubuntu Server หากใช้ OS อื่นอาจต้องปรับคำสั่งบางส่วน
