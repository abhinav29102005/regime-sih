"""Download 2-3 monsoon seasons (June-Sept) of GFS + CHIRPS + ERA5.
Run this ASAP — data downloads are the bottleneck.
"""

import logging
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ingestion.gfs_adapter import GFSAdapter
from ingestion.chirps_adapter import CHIRPSAdapter
from ingestion.era5_adapter import ERA5Adapter
from shared.config import INDIA_BBOX

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    bbox = INDIA_BBOX
    # Start with 1 season for speed: June-Sept 2023
    date_range = ("2023-06-01", "2023-09-30")

    logger.info("=" * 60)
    logger.info("Starting historical data download")
    logger.info(f"Date range: {date_range}")
    logger.info(f"Bounding box: {bbox}")
    logger.info("=" * 60)

    # CHIRPS first — fastest, no auth
    logger.info("--- Downloading CHIRPS (no auth, moderate size) ---")
    try:
        chirps = CHIRPSAdapter()
        chirps_data = chirps.fetch(date_range, bbox)
        logger.info(f"CHIRPS: {chirps_data}")
    except Exception as e:
        logger.error(f"CHIRPS download failed: {e}")

    # GFS from S3 — no auth, fast
    logger.info("--- Downloading GFS from S3 (no auth) ---")
    try:
        gfs = GFSAdapter()
        gfs_data = gfs.fetch(date_range, bbox)
        logger.info(f"GFS: {gfs_data}")
    except Exception as e:
        logger.error(f"GFS download failed: {e}")

    # ERA5 — requires CDS account, may queue
    logger.info("--- Submitting ERA5 request (may queue 15-30 min) ---")
    try:
        era5 = ERA5Adapter()
        era5_data = era5.fetch(date_range, bbox)
        logger.info(f"ERA5: {era5_data}")
    except ImportError as e:
        logger.warning(f"ERA5 skipped (cdsapi not configured): {e}")
    except Exception as e:
        logger.error(f"ERA5 download failed: {e}")

    logger.info("Download script complete.")


if __name__ == "__main__":
    main()
