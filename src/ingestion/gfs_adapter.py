"""GFS (Global Forecast System) data adapter.
Downloads 0.25° GRIB2 data from NOAA's public S3 bucket (no auth required).
Source: s3://noaa-gfs-bdp-pds/
"""

import os
import logging
from datetime import datetime, timedelta

import boto3
import numpy as np
import xarray as xr
from botocore import UNSIGNED
from botocore.config import Config

from ingestion.base import DataSourceAdapter
from shared.config import RAW_DIR

logger = logging.getLogger(__name__)


class GFSAdapter(DataSourceAdapter):
    """Fetches GFS forecast data from NOAA's public AWS S3 bucket."""

    BUCKET = "noaa-gfs-bdp-pds"
    # Path pattern: gfs.YYYYMMDD/HH/atmos/gfs.tHHz.pgrb2.0p25.fFFF
    # HH = init hour (00, 06, 12, 18), FFF = forecast lead hours (000-384)

    def __init__(self, cache_dir: str = os.path.join(RAW_DIR, "gfs")):
        self.s3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _s3_key(self, date: datetime, init_hour: int, lead_hour: int) -> str:
        date_str = date.strftime("%Y%m%d")
        return (
            f"gfs.{date_str}/{init_hour:02d}/atmos/"
            f"gfs.t{init_hour:02d}z.pgrb2.0p25.f{lead_hour:03d}"
        )

    def _download_grib(self, date: datetime, init_hour: int, lead_hour: int) -> str:
        """Download a single GRIB2 file, return local path."""
        key = self._s3_key(date, init_hour, lead_hour)
        local_path = os.path.join(
            self.cache_dir,
            f"{date.strftime('%Y%m%d')}_{init_hour:02d}z_f{lead_hour:03d}.grib2",
        )

        if os.path.exists(local_path):
            logger.info(f"Cache hit: {local_path}")
            return local_path

        logger.info(f"Downloading s3://{self.BUCKET}/{key}")
        self.s3.download_file(self.BUCKET, key, local_path)
        return local_path

    def fetch(self, date_range: tuple, bbox: tuple) -> xr.Dataset:
        """Fetch GFS accumulated precipitation for the given period.

        Args:
            date_range: (start_str, end_str) e.g. ("2023-06-01", "2023-06-30")
            bbox: (lat_min, lat_max, lon_min, lon_max)

        Returns:
            xr.Dataset with dims (time, lat, lon) and var 'precip_mm'
        """
        start = datetime.strptime(date_range[0], "%Y-%m-%d")
        end = datetime.strptime(date_range[1], "%Y-%m-%d")
        lat_min, lat_max, lon_min, lon_max = bbox

        datasets = []
        current = start
        while current <= end:
            for init_hour in [0, 12]:  # Use 00Z and 12Z runs
                for lead in [6, 12, 18, 24]:  # 6-hourly lead times out to 24h
                    try:
                        grib_path = self._download_grib(current, init_hour, lead)
                        ds = xr.open_dataset(
                            grib_path,
                            engine="cfgrib",
                            backend_kwargs={
                                "filter_by_keys": {"shortName": "tp"},  # total precip
                            },
                        )
                        # Subset to India bbox
                        ds = ds.sel(
                            latitude=slice(lat_max, lat_min),
                            longitude=slice(lon_min, lon_max),
                        )
                        # Normalize variable name
                        ds = ds.rename({"tp": "precip_mm", "latitude": "lat", "longitude": "lon"})
                        ds["precip_mm"] = ds["precip_mm"] * 1000  # m → mm
                        ds = ds.assign_coords(forecast_lead_hours=lead)
                        datasets.append(ds)
                    except Exception as e:
                        logger.warning(f"Failed to fetch GFS {current} {init_hour}Z f{lead}: {e}")
            current += timedelta(days=1)

        if not datasets:
            raise RuntimeError("No GFS data fetched for the given date range.")

        return xr.concat(datasets, dim="time")

    def source_metadata(self) -> dict:
        return {
            "name": "NOAA GFS",
            "resolution": "0.25°",
            "latency": "~4h after init time",
            "license": "Public domain (US Government)",
            "last_updated": datetime.utcnow().isoformat(),
        }
