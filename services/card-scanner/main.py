"""
FastAPI visual card scanning service.
Provides instant card recognition via OpenCV Hough/contour detection and visual vector search.
"""

import time
import uuid
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    top_k: int = Form(5)
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

    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
    scan_id = str(uuid.uuid4())

    best = results[0] if results else None
    best_score = best["score"] if best else 0.0
    second_score = results[1]["score"] if len(results) > 1 else 0.0
    margin = round(best_score - second_score, 4) if len(results) > 1 else 0.10

    # Confident match logic:
    # 1. High absolute similarity (>= 0.38) -> instant match
    # 2. Moderate similarity (>= 0.34) WITH a distinct margin (>= 0.035) above rank 2 -> matches real cards under room lighting while strictly rejecting random desks/walls
    is_confident_match = bool(
        best and (
            best_score >= 0.38 or
            (best_score >= 0.34 and margin >= 0.035)
        )
    )

    if not is_confident_match or best is None:
        return {
            "status": "no_match",
            "scan_id": scan_id,
            "detection_source": chosen_source,
            "confidence": best_score,
            "candidates": results,
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
        "candidates": [
            {
                "id": r["card"]["id"],
                "code": r["card"]["code"],
                "name": r["card"]["name"],
                "game": r["card"]["game"],
                "setCode": r["card"]["setCode"],
                "cardNumber": clean_card_number(r["card"].get("cardNumber")),
                "language": r["card"]["language"],
                "rarity": r["card"]["rarity"],
                "variant": r["card"]["variant"],
                "score": r["score"],
                "imageUrl": r["card"]["imageUrl"]
            }
            for r in results
        ],
        "latency_ms": elapsed_ms
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=2)
