# Meghdrishti Server Management Guide

This document contains all the necessary commands and instructions for deploying, updating, and managing the Meghdrishti application on the Azure VM.

## 1. Connecting to the Server

The server is heavily protected behind Cloudflare Zero Trust. To access it, you must have `cloudflared` installed locally and use the correct SSH configuration.

```bash
# Connect to the Azure VM
ssh -o StrictHostKeyChecking=no azureuser@<YOUR_SERVER_DOMAIN_OR_IP>
```

---

## 2. Managing the FastAPI Backend
 
The backend is running as a systemd service called `meghdrishti-api`.

```bash
# Update code and redeploy the backend (Run from your local PC or inside the VM)
cd /home/azureuser/regime-sih
git pull
sudo systemctl restart meghdrishti-api

# Check the live status of the API
sudo systemctl status meghdrishti-api

# View real-time API logs (useful for debugging 500 errors)
sudo journalctl -u meghdrishti-api -f
```

---

## 3. Managing Cloudflare Zero Trust Tunnels

If you make changes to your Public Hostnames or routing rules in the Cloudflare Dashboard, the Azure VM needs to restart its tunnel to pull the fresh configuration.

```bash
# Restart the Cloudflare tunnel daemon
sudo systemctl restart cloudflared

# Check tunnel status
sudo systemctl status cloudflared

# View tunnel connection logs
sudo journalctl -u cloudflared -f
```

---

## 4. Running the ML Pipeline (Data Refresh)

When you need to fetch new weather data, re-train the Random Forest model, and push new predictions to the Turso database, run the Machine Learning pipeline script.

```bash
# Activate the Python virtual environment
cd /home/azureuser/regime-sih
source .venv/bin/activate

# Execute the pipeline (Fetches data, trains model, updates Turso DB)
python3 ml_pipeline.py
```

---

## 5. (Optional) Deploying the Next.js Frontend on the VM

If you decide to host the frontend on the Azure VM instead of Vercel, you should use `pm2` (Node Process Manager).

```bash
# 1. Install PM2 globally
sudo npm install -g pm2

# 2. Build the Next.js production bundle
cd /home/azureuser/regime-sih/frontend
npm run build

# 3. Start the frontend on Port 3000
pm2 start npm --name "meghdrishti-frontend" -- start

# 4. Save PM2 state so it auto-starts on server reboot
pm2 save
pm2 startup

# 5. Check frontend logs
pm2 logs meghdrishti-frontend
```

---

## 6. Turso Database Management

The database is fully serverless and hosted on Turso, meaning you do not need to manage SQLite files locally.

```bash
# View the live Turso Database from the CLI (if turso CLI is installed)
turso db shell regime-sih

# Common SQL Commands:
# > SELECT * FROM regime_history ORDER BY timestamp DESC LIMIT 5;
# > SELECT * FROM district_forecasts WHERE state = "Maharashtra" LIMIT 10;
```
