"""Regime classifier training script.
Trains an XGBoost multi-class classifier on bootstrapped regime labels.
See README Section 4.2 for full spec.
"""

import logging

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from shared.config import REGIME_CLASSES, MODELS_DIR

logger = logging.getLogger(__name__)


def bootstrap_regime_labels(index_table: pd.DataFrame) -> pd.Series:
    """Rule-based regime labeling (README Section 4.2).

    BMI <= -1.0 for >=2 consecutive days → break
    BMI >= +1.0 for >=2 consecutive days → active
    LPS_flag = 1 → depression
    WD_flag = 1 → western_disturbance
    else → normal

    These labels are bootstrapped (not ground truth). The classifier
    learns to generalize from these heuristic labels. Document this
    as a known limitation.
    """
    labels = pd.Series("normal", index=index_table.index)

    bmi = index_table["BMI"]

    # Rolling 2-day consecutive check for break/active
    break_mask = (bmi <= -1.0) & (bmi.shift(1) <= -1.0)
    active_mask = (bmi >= 1.0) & (bmi.shift(1) >= 1.0)

    labels[break_mask] = "break"
    labels[active_mask] = "active"

    # LPS and WD flags override (they're specific synoptic events)
    if "LPS_flag" in index_table.columns:
        labels[index_table["LPS_flag"] == 1] = "depression"
    if "WD_flag" in index_table.columns:
        labels[index_table["WD_flag"] == 1] = "western_disturbance"

    return labels


def train_regime_classifier(
    index_table: pd.DataFrame,
    model_path: str = f"{MODELS_DIR}/regime_classifier.pkl",
) -> xgb.XGBClassifier:
    """Train XGBoost 5-class regime classifier.

    Input features (per day, with trailing window):
        BMI(t), BMI(t-1), BMI(t-2),
        MT_lat(t), MT_lat(t-1),
        LLJ(t), LLJ(t-1),
        OLR_anom(t), PWAT(t),
        MJO_phase(t), MJO_amplitude(t),
        day_of_year_sin, day_of_year_cos

    Output: softmax probability vector over 5 regime classes.
    Loss: categorical cross-entropy with inverse-frequency class weighting.
    """
    feature_cols = [
        "BMI", "BMI_lag1", "BMI_lag2",
        "MT_lat", "MT_lat_lag1",
        "LLJ", "LLJ_lag1",
        "OLR_anom", "PWAT",
        "MJO_phase", "MJO_amplitude",
        "day_of_year_sin", "day_of_year_cos",
    ]

    # Ensure all columns exist
    available_cols = [c for c in feature_cols if c in index_table.columns]
    if len(available_cols) < len(feature_cols):
        missing = set(feature_cols) - set(available_cols)
        logger.warning(f"Missing feature columns: {missing}. Using available: {available_cols}")

    X = index_table[available_cols].copy()
    labels = bootstrap_regime_labels(index_table)

    # Encode labels
    label_map = {name: i for i, name in enumerate(REGIME_CLASSES)}
    y = labels.map(label_map)

    # Drop any unmapped labels
    valid_mask = y.notna()
    X = X[valid_mask]
    y = y[valid_mask].astype(int)

    # Class weights (inverse frequency) — w_k = N_total / (K * N_k)
    class_counts = y.value_counts()
    weights_map = {cls: len(y) / (len(class_counts) * count) for cls, count in class_counts.items()}
    sample_weights = y.map(weights_map).values

    # Train/val split
    X_train, X_val, y_train, y_val, w_train, w_val = train_test_split(
        X, y, sample_weights, test_size=0.2, random_state=42, stratify=y
    )

    logger.info(f"Training regime classifier: {len(X_train)} train, {len(X_val)} val samples")
    logger.info(f"Class distribution:\n{y.value_counts().rename(index={v: k for k, v in label_map.items()})}")

    model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=len(REGIME_CLASSES),
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        eval_metric="mlogloss",
        use_label_encoder=False,
    )

    model.fit(
        X_train, y_train,
        sample_weight=w_train,
        eval_set=[(X_val, y_val)],
        verbose=True,
    )

    # Report
    y_pred = model.predict(X_val)
    report = classification_report(y_val, y_pred, target_names=REGIME_CLASSES, zero_division=0)
    logger.info(f"Validation report:\n{report}")
    print(report)

    # Save
    joblib.dump(model, model_path)
    logger.info(f"Model saved to {model_path}")

    return model


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Load pre-computed regime index table
    import os
    table_path = os.path.join("data", "processed", "regime_index_table.parquet")
    if os.path.exists(table_path):
        index_table = pd.read_parquet(table_path)
        train_regime_classifier(index_table)
    else:
        print(f"No index table found at {table_path}.")
        print("Run feature engineering first to generate the regime index table.")
