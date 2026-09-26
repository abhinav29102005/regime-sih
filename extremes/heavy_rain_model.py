"""Heavy-rain probability model (Section 6).
Binary classifiers for IMD heavy rain thresholds with isotonic calibration.
"""

import logging
import os

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.isotonic import IsotonicRegression
from sklearn.model_selection import train_test_split

from shared.config import MODELS_DIR

logger = logging.getLogger(__name__)


class HeavyRainProbabilityModel:
    """Calibrated binary classifiers for IMD heavy rain thresholds.

    Trains one XGBClassifier per threshold (default: 64.5mm and 115.5mm).
    Applies isotonic regression calibration on a holdout set.
    """

    def __init__(self, model_path: str = os.path.join(MODELS_DIR, "heavy_rain.pkl")):
        self.model_path = model_path
        self.models: dict[float, xgb.XGBClassifier] = {}
        self.calibrators: dict[float, IsotonicRegression] = {}

    def train(
        self,
        X: pd.DataFrame,
        observed_precip: np.ndarray,
        thresholds: tuple[float, ...] = (64.5, 115.5),
    ):
        """Train and calibrate binary classifiers for each threshold.

        Args:
            X: Feature matrix (same covariates as correction model).
            observed_precip: Observed precipitation values (ground truth).
            thresholds: IMD thresholds in mm (heavy=64.5, very_heavy=115.5).
        """
        for tau in thresholds:
            y = (observed_precip >= tau).astype(int)
            pos_count = y.sum()

            if pos_count < 5:
                logger.warning(f"Threshold {tau}mm: only {pos_count} positive samples, skipping")
                continue

            w_pos = (y == 0).sum() / max(pos_count, 1)

            # Split for calibration
            X_train, X_cal, y_train, y_cal = train_test_split(
                X, y, test_size=0.3, random_state=42, stratify=y
            )

            model = xgb.XGBClassifier(
                n_estimators=150,
                max_depth=5,
                scale_pos_weight=w_pos,
                objective="binary:logistic",
                use_label_encoder=False,
                eval_metric="logloss",
            )
            model.fit(X_train, y_train)

            # Isotonic calibration on holdout
            raw_probs = model.predict_proba(X_cal)[:, 1]
            calibrator = IsotonicRegression(out_of_bounds="clip")
            calibrator.fit(raw_probs, y_cal)

            self.models[tau] = model
            self.calibrators[tau] = calibrator

            logger.info(
                f"Trained heavy rain model for {tau}mm: "
                f"{pos_count}/{len(y)} positive ({100*pos_count/len(y):.1f}%)"
            )

        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump((self.models, self.calibrators), self.model_path)
        logger.info(f"Saved heavy rain models to {self.model_path}")

    def load(self):
        """Load pre-trained models and calibrators from disk."""
        self.models, self.calibrators = joblib.load(self.model_path)
        logger.info(f"Loaded heavy rain models for thresholds: {list(self.models.keys())}")

    def predict_proba(self, X: pd.DataFrame) -> dict[float, np.ndarray]:
        """Predict calibrated heavy rain probabilities.

        Args:
            X: Feature matrix.

        Returns:
            {threshold_mm: calibrated_probability_array}
        """
        result = {}
        for tau, model in self.models.items():
            raw_prob = model.predict_proba(X)[:, 1]
            result[tau] = self.calibrators[tau].predict(raw_prob)
        return result
