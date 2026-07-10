# Deploying CloudNSofts (single VM + nginx + Cloudflare)

Target: Ubuntu 24.04 VM (4 vCPU / 4.7 GB), domain **cloudnsofts.com** on
Cloudflare. nginx terminates on **:443** and reverse-proxies to the app;
Postgres + MinIO run in Docker, bound to localhost; backend + frontend run
under pm2. Only 443 (and 22) are public.

```
Cloudflare (proxied, TLS)  ──443──►  nginx  ──►  Next.js  :3000
                                            └──►  backend  :4000  ──►  Postgres/MinIO (Docker, localhost)
```

## 0. One-time host setup
```bash
bash deploy/setup-prereqs.sh     # Docker, Node 20, nginx, pm2  (re-login after, for docker group)
```

## 1. Get the code onto the VM
From your laptop (includes uncommitted work; skips heavy dirs):
```bash
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude '**/dist' \
  ./  cnsofts-server:~/app/
```

## 2. Data services (Postgres + MinIO)
```bash
cd ~/app
cp deploy/deploy.env.example deploy/deploy.env      # set strong DB + MinIO passwords
docker compose --env-file deploy/deploy.env -f deploy/compose.prod.yml up -d
```

## 3. Backend env
```bash
cp deploy/backend.env.example backend/.env          # fill secrets; must match deploy.env
#   AUTH_SECRET:  openssl rand -hex 32
#   DATABASE_URL / S3_SECRET_KEY:  match deploy.env passwords
#   CORS_ORIGIN=https://cloudnsofts.com
```

## 4. Install, migrate, build
```bash
cd ~/app
npm ci
npm run build:shared
# backend: prisma client + apply migrations + compile
npm --workspace @cnsofts/backend run build
( cd backend && npx prisma migrate deploy )
# bundle the MCP server (served for download)
npm run bundle -w @cnsofts/mcp
# frontend: bake the public API base at build time, then build
NEXT_PUBLIC_API_URL=https://cloudnsofts.com npm --workspace @cnsofts/frontend run build
```

## 5. Run under pm2
```bash
cd ~/app
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup            # run the printed command once, so it survives reboot
```

## 6. nginx + TLS
Create a **Cloudflare Origin Certificate** (dashboard → SSL/TLS → Origin Server
→ Create Certificate) and install it:
```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo tee /etc/ssl/cloudflare/cloudnsofts.pem >/dev/null   # paste the certificate
sudo tee /etc/ssl/cloudflare/cloudnsofts.key >/dev/null   # paste the private key
sudo chmod 600 /etc/ssl/cloudflare/cloudnsofts.key

sudo cp deploy/nginx/cloudnsofts.conf /etc/nginx/sites-available/cloudnsofts.conf
sudo ln -sf /etc/nginx/sites-available/cloudnsofts.conf /etc/nginx/sites-enabled/cloudnsofts.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo cp deploy/nginx/cloudflare-realip.conf /etc/nginx/conf.d/cloudflare-realip.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Cloudflare
- **DNS:** `A  cloudnsofts.com → <VM public IP>` (Proxied 🟠), and
  `CNAME  www → cloudnsofts.com` (Proxied).
- **SSL/TLS mode:** Full (strict).
- **NSG:** inbound 443 open (done). Optionally restrict 443 to Cloudflare IP
  ranges for defense in depth.

## 8. Smoke test
```bash
# on the VM (origin):
curl -sk https://localhost/health            # {"status":"ok"...}
curl -sk https://localhost/api/auth/login -X POST -H 'content-type: application/json' -d '{}' # 400 (reachable)
# publicly, once DNS propagates:
curl -s https://cloudnsofts.com/health
```

## Redeploys
```bash
rsync ... ./ cnsofts-server:~/app/     # step 1
cd ~/app && npm ci && npm run build:shared \
  && npm --workspace @cnsofts/backend run build && ( cd backend && npx prisma migrate deploy ) \
  && NEXT_PUBLIC_API_URL=https://cloudnsofts.com npm --workspace @cnsofts/frontend run build
pm2 reload deploy/ecosystem.config.cjs
```
