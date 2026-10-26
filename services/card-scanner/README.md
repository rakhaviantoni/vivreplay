# VivrePlay Visual Card Scanner Microservice

A fast (<150ms) visual card scanning engine designed to run on a Linux VPS (Ubuntu/Debian).

Matches cards using **OpenCV Hough Line / Contour perspective correction** and **MobileNetV3 visual embeddings** against catalog card artwork, eliminating the lag, heat, and blur issues of in-browser mobile OCR.

---

## Architecture

1. **Client / Mobile Browser**: Takes a picture and sends it as `POST /api/scan` (`multipart/form-data`).
2. **OpenCV Edge & Perspective Transform**: Detects the 4 corners of the card with Hough Line Transform (`HoughLinesP`) or Contour Polygon Approximation, flattens and deskews the card into a normalized vertical rectangle.
3. **Visual Embedding Search**: Computes a 576-dimensional vector using MobileNetV3 and calculates cosine similarity against pre-indexed catalog card embeddings.
4. **Instant Match**: Returns `{ status: "match", product: { ... }, confidence: 0.88, latency_ms: 65 }`.

---

## Server Requirements

* **OS**: Ubuntu 20.04 / 22.04 / 24.04 (or Debian 11/12)
* **Hardware**: Any basic VPS (1–2 vCPUs, 1–2 GB RAM)
* **Port**: 8000 (can be reverse-proxied with Nginx)

---

## Quick Deployment on Ubuntu

### Option A: 1-Step Setup Script (Native Systemd)

```bash
# 1. Clone or copy services/card-scanner to your VPS:
git clone https://github.com/rakhaviantoni/vivreplay.git
cd vivreplay/services/card-scanner

# 2. Run the automated installer:
sudo bash setup.sh
```

The script will:
* Install Python 3, pip, venv, and OpenCV system dependencies (`libgl1`, `libglib2.0-0`).
* Create a Python virtual environment.
* Install CPU-optimized PyTorch and FastAPI dependencies.
* Configure and start the `card-scanner` systemd service.

### Option B: Docker Compose

```bash
cd services/card-scanner
docker compose up -d --build
```

---

## Building the Catalog Index

Before the scanner can match cards, generate the catalog embeddings:

1. **On your development machine or VPS**, export the catalog cards:
   ```bash
   npm run catalog:export-scanner
   # Or: npx tsx scripts/export-catalog-for-scanner.ts
   ```
   This generates `services/card-scanner/data/catalog_seed.json`.

2. **Run the indexer**:
   ```bash
   cd services/card-scanner
   source venv/bin/activate
   python indexer.py --input data/catalog_seed.json --output data --workers 16
   ```
   * Downloads card artworks into `data/image_cache/`.
   * Generates `data/catalog_embeddings.npy` and `data/catalog_metadata.json`.
   * Takes only ~3–5 minutes for 20,000+ cards.
   * Total index memory in RAM is only **~35 MB**!

3. **Reload the scanner service**:
   ```bash
   sudo systemctl restart card-scanner
   # Or: docker compose restart
   ```

---

## Testing the Scanner

Check health:
```bash
curl http://localhost:8000/health
# {"status":"ok","device":"cpu","indexed_cards":24580,"ready":true}
```

Scan a card image:
```bash
curl -X POST http://localhost:8000/api/scan \
  -F "image=@photo.jpg" \
  -F "game=one-piece"
```

Response:
```json
{
  "status": "match",
  "scan_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "detection_source": "hough",
  "confidence": 0.8412,
  "product": {
    "id": "10000000-0000-4000-8000-000000000019",
    "code": "OP05-119",
    "name": "Monkey D. Luffy",
    "game": "one-piece",
    "setCode": "OP-05",
    "cardNumber": "OP05-119_p1",
    "language": "EN",
    "rarity": "SEC",
    "variant": "Manga Rare",
    "score": 0.8412,
    "imageUrl": "https://cards.oplaytcg.com/OP05/en/small/OP05-119_p1.webp"
  },
  "candidates": [...],
  "latency_ms": 78.4
}
```

---

## Setting up Nginx & HTTPS (Optional)

To expose the scanner with HTTPS (e.g., `https://scan.yourdomain.com`):

```nginx
server {
    server_name scan.yourdomain.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Obtain free SSL certificate:
```bash
sudo certbot --nginx -d scan.yourdomain.com
```
