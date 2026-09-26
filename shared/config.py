"""Shared configuration constants."""

INDIA_BBOX = (6.0, 38.0, 65.0, 98.0)
MONSOON_CORE_ZONE = (18.0, 28.0, 73.0, 86.0)

IMD_THRESHOLDS = {
    "light": (0.1, 15.5),
    "moderate": (15.6, 64.4),
    "heavy": (64.5, 115.5),
    "very_heavy": (115.6, 204.4),
    "extremely_heavy": (204.5, float("inf")),
}

REGIME_CLASSES = ["active", "break", "depression", "western_disturbance", "normal"]

DATA_DIR = "data/"
RAW_DIR = "data/raw/"
PROCESSED_DIR = "data/processed/"
MODELS_DIR = "data/models/"
