"""Train the XGBoost crop classifier.

Dataset: "Crop Recommendation" (columns N,P,K,temperature,humidity,ph,rainfall,label),
e.g. https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset
Place it at ml-service/data/Crop_recommendation.csv, then run:

    python training/train_crop.py
"""

import argparse
from datetime import date
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[1]
FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=ROOT / "data" / "Crop_recommendation.csv", type=Path)
    parser.add_argument("--out", default=ROOT / "app" / "models" / "crop_xgb.joblib", type=Path)
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    df["label"] = df["label"].str.strip().str.lower()
    encoder = LabelEncoder()
    y = encoder.fit_transform(df["label"])
    x_train, x_test, y_train, y_test = train_test_split(df[FEATURES], y, test_size=0.2, stratify=y, random_state=42)

    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="multi:softprob",
        eval_metric="mlogloss",
    )
    model.fit(x_train, y_train)

    pred = model.predict(x_test)
    acc = accuracy_score(y_test, pred)
    f1 = f1_score(y_test, pred, average="macro")
    print(f"accuracy={acc:.4f} macro_f1={f1:.4f}")
    print(classification_report(y_test, pred, target_names=encoder.classes_))

    reports = ROOT / "reports"
    reports.mkdir(exist_ok=True)
    plt.figure(figsize=(12, 10))
    labels = [str(c) for c in encoder.classes_]
    sns.heatmap(confusion_matrix(y_test, pred), xticklabels=labels, yticklabels=labels, cmap="Greens")
    plt.title(f"Crop model confusion matrix (accuracy {acc:.3f})")
    plt.tight_layout()
    plt.savefig(reports / "confusion_matrix.png", dpi=120)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    version = f"xgb-{date.today().isoformat()}-acc{acc:.3f}"
    joblib.dump({"model": model, "label_encoder": encoder, "features": FEATURES, "version": version}, args.out)
    print(f"saved {args.out} ({version})")


if __name__ == "__main__":
    main()
