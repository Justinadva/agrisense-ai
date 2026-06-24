"""
ai-server/main.py
FastAPI server untuk inferensi YOLOv8 real-time dari webcam AgriSense AI.

Cara pakai:
  1. Letakkan file model di folder ini: best (10) (2).pt
  2. Jalankan: python main.py  (atau double-click start.bat)
  3. Server berjalan di http://localhost:8000
  4. Buka http://localhost:8000/docs untuk Swagger UI
"""

import os
import io
import time
import base64
import traceback
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO

# ─── Config ───────────────────────────────────────────────────────────────────

# Cari file .pt di folder ini secara otomatis
MODEL_DIR  = Path(__file__).parent
MODEL_FILE = os.getenv("MODEL_PATH", str(MODEL_DIR / "best (10) (2).pt"))
CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.35"))
IOU_THRESHOLD  = float(os.getenv("IOU_THRESHOLD",  "0.45"))
IMG_SIZE       = int(os.getenv("IMG_SIZE", "640"))

# ─── App & CORS ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="AgriSense AI Server",
    description="YOLOv8 plant disease detection API for AgriSense dashboard",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Next.js di localhost:3000
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Model ───────────────────────────────────────────────────────────────

model: YOLO | None = None
model_load_error: str = ""

def load_model() -> None:
    global model, model_load_error
    if not Path(MODEL_FILE).exists():
        model_load_error = f"Model file tidak ditemukan: {MODEL_FILE}"
        print(f"[ERROR] {model_load_error}")
        return
    try:
        print(f"[AI] Loading model: {MODEL_FILE}")
        model = YOLO(MODEL_FILE)
        model.fuse()  # optimasi inference
        print(f"[AI] ✓ Model loaded — classes: {list(model.names.values())}")
    except Exception as e:
        model_load_error = str(e)
        print(f"[ERROR] Gagal load model: {e}")

load_model()

# ─── Schemas ──────────────────────────────────────────────────────────────────

class DetectRequest(BaseModel):
    """Kirim frame sebagai base64 data URL (data:image/jpeg;base64,...)"""
    image: str          # base64 encoded image
    confidence: float = CONF_THRESHOLD

class BoundingBox(BaseModel):
    x: float            # normalized 0-1
    y: float
    width: float
    height: float
    label: str
    confidence: float
    color: str

class DetectResponse(BaseModel):
    success: bool
    boxes: list[BoundingBox]
    inference_ms: float
    summary: str        # e.g. "Healthy Leaf (96%)"
    raw_classes: list[str]

# ─── Helpers ──────────────────────────────────────────────────────────────────

# Warna per kelas (sesuai label model kamu)
CLASS_COLORS: dict[str, str] = {
    "Healthy":             "#22c55e",
    "Healthy Leaf":        "#22c55e",
    "Early Blight":        "#ef4444",
    "Late Blight":         "#f97316",
    "Leaf Spot":           "#f59e0b",
    "Moisture Stress":     "#3b82f6",
    "Bacterial Spot":      "#a855f7",
    "Septoria Leaf Spot":  "#ec4899",
}

def get_color(label: str) -> str:
    for k, v in CLASS_COLORS.items():
        if k.lower() in label.lower():
            return v
    return "#94a3b8"  # abu-abu default

def decode_image(b64_data: str) -> np.ndarray:
    """Decode base64 data URL ke numpy array BGR (OpenCV format)."""
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]
    raw = base64.b64decode(b64_data)
    img_pil = Image.open(io.BytesIO(raw)).convert("RGB")
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root() -> dict[str, Any]:
    return {
        "status": "running",
        "model_loaded": model is not None,
        "model_file": MODEL_FILE,
        "error": model_load_error or None,
        "classes": list(model.names.values()) if model else [],
        "docs": "http://localhost:8000/docs",
    }

@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok" if model else "model_not_loaded",
        "model_loaded": model is not None,
        "error": model_load_error or None,
    }

@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest) -> DetectResponse:
    """
    Terima frame webcam sebagai base64, jalankan YOLOv8, kembalikan bounding boxes.
    """
    if model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model belum dimuat: {model_load_error}",
        )

    try:
        img_bgr = decode_image(req.image)
        h, w = img_bgr.shape[:2]

        t0 = time.perf_counter()
        results = model.predict(
            source=img_bgr,
            conf=req.confidence,
            iou=IOU_THRESHOLD,
            imgsz=IMG_SIZE,
            verbose=False,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000

        boxes: list[BoundingBox] = []
        raw_classes: list[str] = []

        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                label  = model.names[cls_id]
                conf   = float(box.conf[0])

                # xyxy → normalized xywh
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                bx = x1 / w
                by = y1 / h
                bw = (x2 - x1) / w
                bh = (y2 - y1) / h

                boxes.append(BoundingBox(
                    x=round(bx, 4),
                    y=round(by, 4),
                    width=round(bw, 4),
                    height=round(bh, 4),
                    label=label,
                    confidence=round(conf, 3),
                    color=get_color(label),
                ))
                raw_classes.append(label)

        # Summary text
        if boxes:
            top = max(boxes, key=lambda b: b.confidence)
            summary = f"{top.label} ({top.confidence*100:.0f}%)"
        else:
            summary = "Tidak ada deteksi"

        return DetectResponse(
            success=True,
            boxes=boxes,
            inference_ms=round(elapsed_ms, 1),
            summary=summary,
            raw_classes=raw_classes,
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("  AgriSense AI Server")
    print(f"  Model : {MODEL_FILE}")
    print(f"  URL   : http://localhost:8000")
    print(f"  Docs  : http://localhost:8000/docs")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
