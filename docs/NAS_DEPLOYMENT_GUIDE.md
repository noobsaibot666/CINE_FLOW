# CineFlow NAS Deployment Guide

This document outlines the sequential steps required to deploy the CineFlow Licensing Server to your TrueNAS/NAS environment.

## 1. Local Preparation
Before touching the NAS, ensure all changes are committed and pushed to your central repository.

1.  **Commit Code**: Ensure `server.js`, `Dockerfile`, and `docker-compose.yml` are committed.
2.  **Push to GitHub**: `git push origin main`
3.  **Note Secrets**: Copy the values from your local `licensing-server/.env` file. You will need these on the NAS.

---

## 2. NAS Environment Setup
Access your NAS via SSH or its web-based terminal.

1.  **Navigate to Deployment Root**:
    ```bash
    cd /mnt/data/apps/cineflow-licensing
    ```
2.  **Pull Latest Changes**:
    ```bash
    git pull origin main
    ```
3.  **Create Environment File**:
    Create a new `.env` file in the `licensing-server` directory.
    ```bash
    nano .env
    ```
    **Paste your production variables**:
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
    - `PRIVATE_KEY_B64`
    - `RESEND_API_KEY`
    - `ADMIN_SECRET`
    - `PORT=3002`

4.  **Create Data Volume**:
    Ensure the database directory exists to maintain license persistence.
    ```bash
    mkdir -p data
    ```

---

## 3. Deployment (Docker)
Run the server using the optimized production configuration.

1.  **Build & Start**:
    ```bash
    docker compose up -d --build
    ```
2.  **Verify Status**:
    ```bash
    docker logs -f cineflow-licensing
    ```
    *You should see: "CineFlow Licensing Engine active on port 3002"*

---

## 4. Traefik / Reverse Proxy Configuration
To make the server accessible at `https://licensing.alan-design.com`, update your Traefik labels or Nginx configuration.

### Traefik Labels (Add to docker-compose.yml on NAS):
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.licensing.rule=Host(`licensing.alan-design.com`)"
  - "traefik.http.routers.licensing.entrypoints=websecure"
  - "traefik.http.routers.licensing.tls.certresolver=myresolver"
  - "traefik.http.services.licensing.loadbalancer.server.port=3002"
```

---

## 5. Final Verification
Once the NAS deployment is live, perform a "Health Check":

1.  **Dashboard Access**: Visit `https://alan-design.com/#/admin/licensing`.
2.  **Authorize**: Enter your `ADMIN_SECRET`.
3.  **API Check**: Confirm that the table loads licenses from the NAS database.

---
**Warning**: Never commit your `.env` file to GitHub. Always manage secrets directly on the NAS environment.
