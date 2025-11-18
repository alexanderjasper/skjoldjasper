# Ubuntu Server Deployment Guide

This guide will help you deploy the skjoldjasper project on a fresh Ubuntu Server installation.

## Prerequisites

- Ubuntu Server (22.04 LTS or later recommended)
- SSH access to the server
- A domain name (optional, for Cloudflare Tunnel)
- Supabase account (for authentication)

## Step 1: Initial Server Setup

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Required Software

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose (plugin)
sudo apt install docker-compose-plugin -y

# Install Git
sudo apt install git -y

# Log out and back in (or run: newgrp docker) for group changes to take effect
```

### 1.3 Verify Docker Installation

```bash
docker --version
docker compose version
```

## Step 2: Clone the Repository

```bash
# Navigate to a suitable directory (e.g., /opt or your home directory)
cd ~
git clone https://github.com/alexanderjasper/skjoldjasper.git
cd skjoldjasper
```

## Step 3: Configure Environment Variables

### 3.1 Infrastructure Environment

```bash
cp infra/env.example infra/.env
nano infra/.env
```

Edit the following values:
- `POSTGRES_USER` - Database user (default: `app`)
- `POSTGRES_PASSWORD` - **Change this to a strong password**
- `POSTGRES_DB` - Database name (default: `appdb`)
- `CLOUDFLARED_TUNNEL_TOKEN` - (Optional) Cloudflare Tunnel token if using Cloudflare Tunnel

### 3.2 Web Application Environment

```bash
cp apps/web/env.example apps/web/.env
nano apps/web/.env
```

Required values:
- `DATABASE_URL` - Will be set automatically by docker-compose, but you can override
- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `PUBLIC_GAME_SERVER_WS` - WebSocket URL for game server (e.g., `ws://your-domain:2567` or `wss://ws.your-domain` if using Cloudflare Tunnel)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins (e.g., `https://app.your-domain`)

### 3.3 Game Server Environment

```bash
cp apps/game-server/env.example apps/game-server/.env
nano apps/game-server/.env
```

Required values:
- `DATABASE_URL` - Will be set automatically by docker-compose
- `SENTRY_DSN` - (Optional) Sentry DSN for error tracking

### 3.4 Database Package Environment

```bash
cp packages/db/env.example packages/db/.env
nano packages/db/.env
```

Set `DATABASE_URL` to match your Postgres connection:
```
DATABASE_URL=postgres://app:YOUR_PASSWORD@localhost:5432/appdb
```

## Step 4: Set Up Supabase Authentication

1. Create a Supabase project at https://supabase.com
2. Go to Settings → API and copy:
   - Project URL → `PUBLIC_SUPABASE_URL`
   - anon/public key → `PUBLIC_SUPABASE_ANON_KEY`
3. Enable GitHub OAuth provider:
   - Go to Authentication → Providers → GitHub
   - Enable GitHub provider
   - Set callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Add your GitHub OAuth App Client ID and Secret

## Step 5: Deploy the Application

### 5.1 Run the Deployment Script

```bash
chmod +x infra/deploy-ubuntu.sh
bash infra/deploy-ubuntu.sh
```

This script will:
- Stop any existing containers
- Build and start PostgreSQL
- Run database migrations
- Build and start the web application and game server
- Optionally start Cloudflare Tunnel (if configured)

### 5.2 Verify Services are Running

```bash
docker compose -f infra/docker-compose.yml ps
```

You should see:
- `skjoldjasper-postgres` - Running
- `skjoldjasper-web` - Running
- `skjoldjasper-game-server` - Running
- `skjoldjasper-cloudflared` - Running (if configured)

### 5.3 Check Logs

```bash
# View all logs
docker compose -f infra/docker-compose.yml logs -f

# View specific service logs
docker compose -f infra/docker-compose.yml logs -f web
docker compose -f infra/docker-compose.yml logs -f game-server
```

## Step 6: Configure Firewall (if needed)

If you're exposing services directly (not using Cloudflare Tunnel):

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow WebSocket port (if exposing directly)
sudo ufw allow 2567/tcp

# Enable firewall
sudo ufw enable
```

## Step 7: Set Up Cloudflare Tunnel (Optional but Recommended)

1. Install Cloudflare Tunnel on your server or use the Docker container (already configured)
2. Create a tunnel in Cloudflare Zero Trust dashboard
3. Configure routes:
   - `https://app.your-domain` → `http://web:5173`
   - `wss://ws.your-domain` → `http://game-server:2567`
4. Copy the tunnel token to `infra/.env` as `CLOUDFLARED_TUNNEL_TOKEN`
5. Restart the cloudflared service:
   ```bash
   docker compose -f infra/docker-compose.yml up -d cloudflared
   ```

## Step 8: Set Up Backups (Optional)

### 8.1 Configure pgBackRest with Cloudflare R2

1. Create a Cloudflare R2 bucket
2. Create R2 API tokens with read/write permissions
3. Update `infra/.env` with R2 credentials:
   ```
   PGBACKREST_REPO1_S3_BUCKET=your-bucket-name
   PGBACKREST_REPO1_S3_ENDPOINT=YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   PGBACKREST_REPO1_S3_KEY=your-access-key-id
   PGBACKREST_REPO1_S3_KEY_SECRET=your-secret-access-key
   PGBACKREST_REPO1_S3_REGION=auto
   ```

### 8.2 Initialize Backups

```bash
# Create stanza
docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest \
  pgbackrest --stanza=main stanza-create

# Verify configuration
docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm pgbackrest \
  pgbackrest --stanza=main info

# Run initial full backup
bash infra/scripts/pgbackrest-backup.sh full
```

### 8.3 Set Up Automated Backups

Add to crontab:
```bash
crontab -e
```

Add line for daily backups at 2 AM:
```
0 2 * * * cd /path/to/skjoldjasper && bash infra/scripts/pgbackrest-backup.sh diff
```

## Step 9: Update Deployment

When you need to update the application:

```bash
cd ~/skjoldjasper
git pull
bash infra/deploy-ubuntu.sh
```

## Troubleshooting

### Services won't start

1. Check logs: `docker compose -f infra/docker-compose.yml logs`
2. Verify environment variables are set correctly
3. Check Docker is running: `sudo systemctl status docker`

### Database connection errors

1. Verify Postgres is healthy: `docker compose -f infra/docker-compose.yml ps postgres`
2. Check database URL in environment files
3. Verify migrations ran: Check logs for migration output

### Port conflicts

If ports 5173 or 2567 are already in use, you can modify `infra/docker-compose.yml` to use different ports.

### Permission errors

Make sure your user is in the docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

## Maintenance Commands

```bash
# Stop all services
docker compose -f infra/docker-compose.yml down

# Stop and remove volumes (⚠️ deletes data)
docker compose -f infra/docker-compose.yml down -v

# Restart a specific service
docker compose -f infra/docker-compose.yml restart web

# View resource usage
docker stats

# Clean up unused Docker resources
docker system prune -a
```

## Security Considerations

1. **Change default passwords** - Always change `POSTGRES_PASSWORD` and other default credentials
2. **Use Cloudflare Tunnel** - Recommended over exposing ports directly
3. **Keep system updated** - Regularly run `sudo apt update && sudo apt upgrade`
4. **Firewall** - Use UFW to restrict access
5. **Backups** - Set up automated backups with pgBackRest
6. **SSL/TLS** - Use Cloudflare Tunnel or a reverse proxy (nginx) with Let's Encrypt

