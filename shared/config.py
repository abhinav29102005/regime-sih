"""Shared configuration constants.
Both Person A and Person B import from here.
"""

# India bounding box (lat_min, lat_max, lon_min, lon_max)
INDIA_BBOX = (6.0, 38.0, 65.0, 98.0)

# Monsoon Core Zone (MCZ) — used for BMI computation
MONSOON_CORE_ZONE = (18.0, 28.0, 73.0, 86.0)

# IMD standard rainfall categories (mm/24h)
IMD_THRESHOLDS = {
    "light": (0.1, 15.5),
    "moderate": (15.6, 64.4),
    "heavy": (64.5, 115.5),
    "very_heavy": (115.6, 204.4),
    "extremely_heavy": (204.5, float("inf")),
}

# Regime class names (canonical order)
REGIME_CLASSES = ["active", "break", "depression", "western_disturbance", "normal"]

# Data directories
DATA_DIR = "data/"
RAW_DIR = "data/raw/"
PROCESSED_DIR = "data/processed/"
MODELS_DIR = "data/models/"
