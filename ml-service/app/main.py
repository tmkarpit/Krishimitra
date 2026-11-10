"""KrishiMitra crop recommendation model service.

POST /predict/crop  {N, P, K, temperature, humidity, ph, rainfall}
  -> {"predictions": [{"crop": "rice", "probability": 0.81}, ...], "model_version": "..."}
"""

import os
from pathlib import Path

import joblib
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

MODEL_PATH = Path(os.getenv("MODEL_PATH", Path(__file__).parent / "models" / "crop_xgb.joblib"))
API_TOKEN = os.getenv("ML_SERVICE_TOKEN", "")
FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]

app = FastAPI(title="KrishiMitra ML", version="1.0.0")
_bundle: dict | None = None


def bundle() -> dict:
    global _bundle
    if _bundle is None:
        if not MODEL_PATH.exists():
            raise HTTPException(503, "Model not trained yet. Run training/train_crop.py")
        _bundle = joblib.load(MODEL_PATH)
    return _bundle


def check_token(authorization: str = Header(default="")) -> None:
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(401, "Invalid token")


class CropFeatures(BaseModel):
    N: float = Field(ge=0, le=300)
    P: float = Field(ge=0, le=300)
    K: float = Field(ge=0, le=300)
    temperature: float = Field(ge=-10, le=55)
    humidity: float = Field(ge=0, le=100)
    ph: float = Field(ge=3, le=10)
    rainfall: float = Field(ge=0, le=3000)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model_loaded": MODEL_PATH.exists()}


@app.post("/predict/crop", dependencies=[Depends(check_token)])
def predict_crop(features: CropFeatures, top: int = 10) -> dict:
    b = bundle()
    x = np.array([[getattr(features, f) for f in FEATURES]], dtype=float)
    probs = b["model"].predict_proba(x)[0]
    order = np.argsort(probs)[::-1][: max(1, min(top, len(probs)))]
    labels = b["label_encoder"].inverse_transform(order)
    return {
        "predictions": [{"crop": str(label), "probability": round(float(probs[i]), 4)} for label, i in zip(labels, order)],
        "model_version": b["version"],
    }
