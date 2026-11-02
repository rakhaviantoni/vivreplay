"""
FastAPI visual card scanning service.
Provides instant card recognition via OpenCV Hough/contour detection and visual vector search.
"""

import hashlib
import hmac
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Optional
import cv2
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from detector import extract_card
from matcher import CardMatcher

app = FastAPI(
    title="VivrePlay Card Scanner Service",
    description="Sub-150ms visual TCG card recognition engine using OpenCV and visual embeddings",
    version="1.0.0"
)

# Enable CORS for cross-origin requests from VivrePlay web
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*vivreplay\.com$|^http://localhost(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

matcher = CardMatcher(index_dir="data")

IPAYMU_ROUTES = {
    ("GET", "/api/v2/payment-channels"),
    ("POST", "/api/v2/payment"),
    ("POST", "/api/v2/payment/direct"),
    ("POST", "/api/v2/balance"),
    ("POST", "/api/v2/history"),
    ("POST", "/api/v2/transaction"),
}


def consume_ipaymu_proxy_nonce(nonce: str, issued_at: int) -> bool:
    db_path = Path(os.getenv("IPAYMU_PROXY_NONCE_DB", "data/ipaymu-proxy-nonces.sqlite3"))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path, timeout=5) as db:
        db.execute("CREATE TABLE IF NOT EXISTS used_nonces (nonce TEXT PRIMARY KEY, issued_at INTEGER NOT NULL)")
        db.execute("DELETE FROM used_nonces WHERE issued_at < ?", (int(time.time()) - 600,))
        try:
            db.execute("INSERT INTO used_nonces (nonce, issued_at) VALUES (?, ?)", (nonce, issued_at))
            return True
        except sqlite3.IntegrityError:
            return False


@app.post("/api/ipaymu-egress")
async def ipaymu_egress(request: Request):
    secret = os.getenv("IPAYMU_PROXY_SECRET", "").strip()
    if len(secret) < 64:
        raise HTTPException(status_code=503, detail="Payment relay is not configured")

    method = request.headers.get("x-ipaymu-method", "").upper()
    path = request.headers.get("x-ipaymu-path", "")
    mode = request.headers.get("x-ipaymu-mode", "")
    timestamp_header = request.headers.get("x-vivreplay-timestamp", "")
    nonce = request.headers.get("x-vivreplay-nonce", "")
    supplied_signature = request.headers.get("x-vivreplay-signature", "").lower()
    if (method, path) not in IPAYMU_ROUTES or mode not in {"production", "sandbox"}:
        raise HTTPException(status_code=400, detail="Unsupported payment request")
    if not re.fullmatch(r"\d{10}", timestamp_header) or not re.fullmatch(r"[a-f0-9]{32}", nonce) or not re.fullmatch(r"[a-f0-9]{64}", supplied_signature):
        raise HTTPException(status_code=401, detail="Invalid request")
    issued_at = int(timestamp_header)
    if abs(int(time.time()) - issued_at) > 120:
        raise HTTPException(status_code=401, detail="Expired request")

    body = await request.body()
    if len(body) > 65_536 or (method == "GET" and body):
        raise HTTPException(status_code=413, detail="Request is too large")
    body_hash = hashlib.sha256(body).hexdigest()
    canonical = "\n".join((method, path, mode, timestamp_header, nonce, body_hash)).encode()
    expected_signature = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_signature, supplied_signature):
        raise HTTPException(status_code=401, detail="Invalid request")
    try:
        if not consume_ipaymu_proxy_nonce(nonce, issued_at):
            raise HTTPException(status_code=409, detail="Request already used")
    except sqlite3.Error:
        raise HTTPException(status_code=503, detail="Payment relay is temporarily unavailable")

    va = request.headers.get("x-ipaymu-va", "")
    ipaymu_timestamp = request.headers.get("x-ipaymu-timestamp", "")
    ipaymu_signature = request.headers.get("x-ipaymu-signature", "")
    if not va or not re.fullmatch(r"\d{14}", ipaymu_timestamp) or not re.fullmatch(r"[a-fA-F0-9]{64}", ipaymu_signature):
        raise HTTPException(status_code=400, detail="Payment request is incomplete")

    gateway_host = "my.ipaymu.com" if mode == "production" else "sandbox.ipaymu.com"
    headers = {
        "Content-Type": request.headers.get("content-type", "application/json"),
        "va": va,
        "timestamp": ipaymu_timestamp,
        "signature": ipaymu_signature,
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=8.0), follow_redirects=False) as client:
            upstream = await client.request(method, f"https://{gateway_host}{path}", headers=headers, content=body or None)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Payment provider could not be reached")

    content_type = upstream.headers.get("content-type", "application/json")
    return Response(content=upstream.content, status_code=upstream.status_code, headers={"Content-Type": content_type, "Cache-Control": "no-store"})


@app.get("/health")
def health():
    total_cards = len(matcher.catalog_metadata) if matcher.catalog_metadata else 0
    return {
        "status": "ok",
        "device": str(matcher.device),
        "indexed_cards": total_cards,
        "ready": total_cards > 0
    }


def clean_card_number(num: Optional[str]) -> str:
    if not num:
        return ""
    s = str(num).strip()
    if s.upper().startswith("CT-"):
        return ""
    return s


@app.post("/api/scan")
async def scan_card(
    image: UploadFile = File(...),
    game: Optional[str] = Form(None),
    top_k: int = Form(5),
    manual: bool = Form(False)
):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    start_time = time.perf_counter()
    image_bytes = await image.read()
    if len(image_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size exceeds 25 MB limit")

    try:
        # Step 1: Detect card boundary, deskew, and provide viewfinder direct crop
        primary_card, secondary_card, det_meta = extract_card(image_bytes, target_w=400, target_h=560)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Card boundary detection failed: {str(e)}")

    # Step 2: Visual feature embedding and similarity search
    results = matcher.search(primary_card, top_k=top_k, game=game)
    chosen_source = det_meta.get("detection_source", "direct")

    if secondary_card is not None:
        results_secondary = matcher.search(secondary_card, top_k=top_k, game=game)
        primary_score = results[0]["score"] if results else 0.0
        secondary_score = results_secondary[0]["score"] if results_secondary else 0.0
        if secondary_score > primary_score:
            results = results_secondary
            chosen_source = det_meta.get("secondary_source", "secondary")

    # Orientation check: if confidence is moderate (< 0.88), check 180°, 90°, and 270° rotations
    current_best_score = results[0]["score"] if results else 0.0
    if current_best_score < 0.88:
        flipped = cv2.rotate(primary_card, cv2.ROTATE_180)
        results_flipped = matcher.search(flipped, top_k=top_k, game=game)
        flipped_score = results_flipped[0]["score"] if results_flipped else 0.0
        if flipped_score > current_best_score + 0.03:
            results = results_flipped
            current_best_score = flipped_score
            chosen_source = f"{chosen_source}_flipped180"

        if current_best_score < 0.88:
            rot90 = cv2.resize(cv2.rotate(primary_card, cv2.ROTATE_90_CLOCKWISE), (400, 560), interpolation=cv2.INTER_AREA)
            res90 = matcher.search(rot90, top_k=top_k, game=game)
            score90 = res90[0]["score"] if res90 else 0.0
            if score90 > current_best_score + 0.04:
                results = res90
                current_best_score = score90
                chosen_source = f"{chosen_source}_rot90"
            else:
                rot270 = cv2.resize(cv2.rotate(primary_card, cv2.ROTATE_90_COUNTERCLOCKWISE), (400, 560), interpolation=cv2.INTER_AREA)
                res270 = matcher.search(rot270, top_k=top_k, game=game)
                score270 = res270[0]["score"] if res270 else 0.0
                if score270 > current_best_score + 0.04:
                    results = res270
                    current_best_score = score270
                    chosen_source = f"{chosen_source}_rot270"

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    scan_id = str(uuid.uuid4())

    best = results[0] if results else None
    best_score = best["score"] if best else 0.0
    best_name = best["card"]["name"].strip().lower() if best else ""

    # Calculate distinct margin against the top candidate having a genuinely different card name.
    # This ensures reprints / alt-arts of the same card do not artificially shrink the margin.
    different_card_score = 0.0
    for r in results[1:]:
        cand_name = r["card"]["name"].strip().lower()
        if cand_name != best_name:
            different_card_score = r["score"]
            break

    distinct_margin = round(best_score - different_card_score, 4) if different_card_score > 0 else 0.10

    # Confident match evaluation:
    # 1. Manual user trigger (shutter button / upload): accept reasonable match (>= 0.70)
    # 2. Continuous live auto-scan: strictly require high confidence (>= 0.92) or solid similarity (>= 0.80)
    #    with distinct margin (>= 0.025) above the nearest different card to reject blurry hands, partial frames, and random noise.
    if manual:
        is_confident_match = bool(best and best_score >= 0.70)
    else:
        is_confident_match = bool(
            best and (
                best_score >= 0.92 or
                (best_score >= 0.80 and distinct_margin >= 0.025)
            )
        )

    formatted_candidates = [
        {
            "id": r["card"]["id"],
            "code": r["card"]["code"],
            "name": r["card"]["name"],
            "game": r["card"]["game"],
            "setCode": r["card"]["setCode"],
            "cardNumber": clean_card_number(r["card"].get("cardNumber")),
            "language": r["card"].get("language", "EN"),
            "rarity": r["card"].get("rarity", ""),
            "variant": r["card"].get("variant", "Standard"),
            "score": r["score"],
            "confidence": r["confidence"],
            "imageUrl": r["card"].get("imageUrl")
        }
        for r in results
    ]

    if not is_confident_match or best is None:
        return {
            "status": "no_match",
            "scan_id": scan_id,
            "detection_source": chosen_source,
            "confidence": best_score,
            "distinct_margin": distinct_margin,
            "candidates": formatted_candidates,
            "latency_ms": elapsed_ms
        }

    return {
        "status": "match",
        "scan_id": scan_id,
        "detection_source": chosen_source,
        "confidence": best["confidence"],
        "product": {
            "id": best["card"]["id"],
            "code": best["card"]["code"],
            "name": best["card"]["name"],
            "game": best["card"]["game"],
            "setCode": best["card"]["setCode"],
            "cardNumber": clean_card_number(best["card"].get("cardNumber")),
            "language": best["card"]["language"],
            "rarity": best["card"]["rarity"],
            "variant": best["card"]["variant"],
            "score": best["score"],
            "imageUrl": best["card"]["imageUrl"]
        },
        "candidates": formatted_candidates,
        "latency_ms": elapsed_ms
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=2)
