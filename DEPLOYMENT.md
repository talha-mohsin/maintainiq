# MaintainIQ — AWS Production Deployment Guide

## Architecture Overview

```
Internet → CloudFront (CDN) → S3 (Frontend SPA)
         → Route 53 (DNS) → Nginx (SSL + Rate Limit)
                           → PM2 (Node.js Cluster)
                           → Express API (Port 3000)
                           → MongoDB Atlas (Database)
                           → Upstash Redis (Cache)
                           → Cloudinary (Images)
                           → Google Gemini (AI)
```

| Layer | Service | Purpose |
|-------|---------|---------|
| Frontend | Amazon S3 + CloudFront | Static React SPA, global CDN |
| Backend | AWS EC2 + PM2 + Nginx | Express API, SSL, reverse proxy |
| Database | MongoDB Atlas | Managed database cluster |
| Cache | Upstash Redis | API response caching |
| Images | Cloudinary | Evidence image uploads/storage |
| AI | Google Gemini API | Triage, maintenance AI |
| CI/CD | GitHub Actions | Automated deploy on push to main |
| SSL | Let's Encrypt (Certbot) | Free SSL managed by Nginx |

---

## Prerequisites

Gather these credentials before starting:

- **AWS Account** with EC2 + S3 + CloudFront + IAM access
- **MongoDB Atlas** cluster URI (`mongodb+srv://...`)
- **Upstash Redis** connection string (`rediss://...`)
- **Cloudinary** account (cloud name, API key, API secret)
- **Google Gemini API** key
- **Domain name** pointed to your EC2 IP via DNS A record

---

## Step 1 — EC2 Instance Setup

### Launch Instance
1. EC2 Console → **Launch Instance**
2. **AMI**: Ubuntu 24.04 LTS
3. **Instance type**: `t3.small` (minimum) or `t3.medium` (recommended)
4. **Key pair**: Create and download `.pem` key → store it in GitHub Secrets
5. **Security Group** — open inbound ports:
   - `22` (SSH — restrict to your IP)
   - `80` (HTTP — from anywhere)
   - `443` (HTTPS — from anywhere)
   - `3000` (optional, for direct health check testing)

### Initial Server Setup

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# System update
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Create PM2 log directory
sudo mkdir -p /var/log/pm2
sudo chown ubuntu:ubuntu /var/log/pm2

# Clone repository
git clone https://github.com/talha-mohsin/final-hackathon.git maintainiq
cd maintainiq

# Create .env file with production values
cp .env.example .env
nano .env   # Fill in all values
```

---

## Step 2 — Nginx Configuration

```bash
# Copy Nginx config
sudo cp nginx.conf /etc/nginx/sites-available/maintainiq

# Replace YOUR_DOMAIN_HERE with your actual domain
sudo sed -i 's/YOUR_DOMAIN_HERE/yourdomain.com/g' /etc/nginx/sites-available/maintainiq

# Enable site
sudo ln -sf /etc/nginx/sites-available/maintainiq /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL with Certbot

```bash
# Obtain SSL certificate (DNS must already point to this server)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (runs twice daily via cron)
sudo systemctl enable certbot.timer
```

---

## Step 3 — First Deployment

```bash
# Install dependencies
npm ci --include=dev

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup | sudo bash

# Verify health
curl http://localhost:3000/health
```

---

## Step 4 — S3 + CloudFront (Frontend)

### Create S3 Bucket
1. S3 Console → **Create bucket**
   - Name: `maintainiq-frontend` (must be globally unique)
   - Region: your region
   - **Uncheck** "Block all public access"
2. **Properties** → Enable Static Website Hosting
   - Index document: `index.html`
   - Error document: `index.html` (SPA routing)
3. **Permissions → Bucket Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::maintainiq-frontend/*"
  }]
}
```

### Create CloudFront Distribution
1. CloudFront Console → **Create Distribution**
   - Origin: select your S3 bucket
   - Viewer Protocol: **Redirect HTTP to HTTPS**
   - Compress objects: **Yes**
   - Default root object: `index.html`
   - Error pages: 404 → `/index.html` (SPA routing)
2. Note the **Distribution ID** and **Domain Name** (e.g., `xxxxx.cloudfront.net`)

---

## Step 5 — GitHub Actions Secrets

Add these secrets in your GitHub repository (**Settings → Secrets and variables → Actions**):

| Secret Name | Value |
|-------------|-------|
| `EC2_HOST` | Your EC2 public IP or domain |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Contents of your `.pem` private key |
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | e.g., `us-east-1` |
| `S3_BUCKET_NAME` | e.g., `maintainiq-frontend` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |
| `APP_URL` | e.g., `https://api.yourdomain.com` |
| `MONGODB_URI` | MongoDB Atlas URI |
| `REDIS_URL` | Upstash/Redis connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `JWT_SECRET` | 64+ char random string |
| `ALLOWED_ORIGINS` | `https://yourdomain.com,https://xxxxx.cloudfront.net` |

---

## Step 6 — Automated Deployment (CI/CD)

After secrets are configured, every push to `main` will:
1. **CI**: Install → Lint → Build → Docker validate → npm audit
2. **CD Backend**: SSH → EC2 → git pull → npm ci → build → PM2 reload → health check → rollback on failure
3. **CD Frontend**: Build with `VITE_API_URL` → S3 sync → CloudFront invalidate

---

## Local Docker Development

```bash
# Copy and fill environment
cp .env.example .env

# Build and run all services (app + mongodb + redis)
docker compose up --build

# Access at http://localhost:3000
# Health: http://localhost:3000/health
# API Docs: http://localhost:3000/api/docs
```

---

## Production Security Checklist

- [x] JWT_SECRET set to 64+ char random value
- [x] MONGODB_URI uses Atlas with auth
- [x] Cloudinary credentials set
- [x] Nginx rate limiting active
- [x] Helmet security headers active
- [x] CORS restricted to known origins
- [x] HTTPS enforced (HTTP redirects)
- [x] Cookies: httpOnly + secure + sameSite=strict
- [x] PM2 auto-restart on crash
- [x] PM2 memory limit: 512MB
- [x] Docker HEALTHCHECK configured
- [x] No secrets in source code
- [x] `.env` in `.gitignore`

---

## Useful Commands

```bash
# Check application status
pm2 status

# View live logs
pm2 logs maintainiq

# Restart
pm2 restart maintainiq

# Zero-downtime reload (no dropped requests)
pm2 reload maintainiq

# Health check
curl https://api.yourdomain.com/health

# API Docs
curl https://api.yourdomain.com/api/docs
```
