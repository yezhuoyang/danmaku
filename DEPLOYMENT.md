# PaperPilot Deployment Guide

Deploy PaperPilot to a VPS with the domain **paperpilot.com**.

## Prerequisites

- A VPS (Ubuntu 22.04 LTS recommended) with at least 1GB RAM
- Domain `paperpilot.com` pointing to your VPS IP address
- SSH access to your server

## Step 1: Server Setup

SSH into your VPS and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2 (process manager)
npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

## Step 2: Create Application Directory

```bash
# Create directories
sudo mkdir -p /var/www/paperpilot
sudo mkdir -p /var/log/paperpilot

# Set ownership (replace 'ubuntu' with your username)
sudo chown -R ubuntu:ubuntu /var/www/paperpilot
sudo chown -R ubuntu:ubuntu /var/log/paperpilot
```

## Step 3: Deploy Application

### Option A: Deploy from Local Machine

On your local Windows machine:

```powershell
# Build the application
pnpm install
pnpm build

# Create deployment package
# Copy these to your server:
# - dist/           (built server and client)
# - package.json
# - pnpm-lock.yaml
# - ecosystem.config.cjs
# - .env.example
```

Use SCP or rsync to upload:

```bash
# From local machine (Git Bash or WSL)
scp -r dist package.json pnpm-lock.yaml ecosystem.config.cjs .env.example user@your-server-ip:/var/www/paperpilot/
```

### Option B: Deploy via Git

On your server:

```bash
cd /var/www/paperpilot
git clone https://github.com/yourusername/paperpilot.git .
pnpm install
pnpm build
```

## Step 4: Configure Environment

```bash
cd /var/www/paperpilot

# Create production .env file
cp .env.example .env

# Generate a secure session secret
openssl rand -base64 32

# Edit .env and add the generated secret
nano .env
```

Your `.env` should look like:

```
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-generated-secret-here
DATABASE_PATH=./data/danmaku.db
```

## Step 5: Install Production Dependencies

```bash
cd /var/www/paperpilot
pnpm install --prod
```

## Step 6: Configure Nginx

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/paperpilot

# Create symlink
sudo ln -s /etc/nginx/sites-available/paperpilot /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t
```

## Step 7: Get SSL Certificate

First, temporarily modify nginx config to serve HTTP (for certbot verification):

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-available/paperpilot
```

Temporarily replace the content with:

```nginx
server {
    listen 80;
    server_name paperpilot.com www.paperpilot.com;
    root /var/www/html;
}
```

Then:

```bash
# Reload nginx
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d paperpilot.com -d www.paperpilot.com

# Restore full nginx config
sudo cp /var/www/paperpilot/nginx.conf /etc/nginx/sites-available/paperpilot
sudo systemctl reload nginx
```

## Step 8: Start the Application

```bash
cd /var/www/paperpilot

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# (follow the instructions printed)
```

## Step 9: Verify Deployment

1. Visit https://paperpilot.com - you should see the home page
2. Check PM2 status: `pm2 status`
3. Check logs: `pm2 logs paperpilot`
4. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

## Maintenance Commands

```bash
# View logs
pm2 logs paperpilot

# Restart application
pm2 restart paperpilot

# Stop application
pm2 stop paperpilot

# View application status
pm2 status

# Monitor resources
pm2 monit
```

## Updating the Application

```bash
cd /var/www/paperpilot

# If using Git
git pull
pnpm install
pnpm build
pm2 restart paperpilot

# If deploying manually, upload new dist folder and restart
pm2 restart paperpilot
```

## Backup Database

```bash
# Create backup directory
mkdir -p /var/www/paperpilot/backups

# Backup database
cp /var/www/paperpilot/data/danmaku.db /var/www/paperpilot/backups/danmaku-$(date +%Y%m%d).db

# Optional: Setup daily cron backup
crontab -e
# Add: 0 3 * * * cp /var/www/paperpilot/data/danmaku.db /var/www/paperpilot/backups/danmaku-$(date +\%Y\%m\%d).db
```

## Troubleshooting

### Application not starting
```bash
# Check PM2 logs
pm2 logs paperpilot --lines 100

# Check if port 3000 is in use
sudo lsof -i :3000
```

### 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Renewal
Certbot auto-renews certificates. To test:
```bash
sudo certbot renew --dry-run
```

## Security Recommendations

1. **Enable firewall**:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

2. **Disable root SSH login** (edit `/etc/ssh/sshd_config`):
   ```
   PermitRootLogin no
   ```

3. **Keep system updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Monitor logs** for suspicious activity regularly.
