"""CHIRPS (Climate Hazards group InfraRed Precipitation with Station data) adapter.
Downloads 0.05° daily rainfall from UCSB — fully open, no auth needed.
Source: https://data.chc.ucsb.edu/products/CHIRPS-2.0/
"""

import os
import logging
from datetime import datetime

import requests
import numpy as np
import xarray as xr

from ingestion.base import DataSourceAdapter
from shared.config import RAW_DIR

logger = logging.getLogger(__name__)


class CHIRPSAdapter(DataSourceAdapter):
    """Fetches CHIRPS daily rainfall (observed/ground truth proxy)."""

    BASE_URL = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/netcdf/p05/"
    # File pattern: chirps-v2.0.YYYY.days_p05.nc (one file per year, ~600MB)

    def __init__(self, cache_dir: str = os.path.join(RAW_DIR, "chirps")):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _download_year(self, year: int) -> str:
        """Download CHIRPS NetCDF for a given year."""
        filename = f"chirps-v2.0.{year}.days_p05.nc"
        local_path = os.path.join(self.cache_dir, filename)

        if os.path.exists(local_path):
            logger.info(f"Cache hit: {local_path}")
            return local_path

        url = f"{self.BASE_URL}{filename}"
        logger.info(f"Downloading {url} (this may take a few minutes)...")
        response = requests.get(url, stream=True)
        response.raise_for_status()

        with open(local_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info(f"Downloaded to {local_path}")
        return local_path

    def fetch(self, date_range: tuple, bbox: tuple) -> xr.Dataset:
        """Fetch CHIRPS observed rainfall, regridded to 0.25°.

        Args:
            date_range: (start_str, end_str) e.g. ("2023-06-01", "2023-09-30")
            bbox: (lat_min, lat_max, lon_min, lon_max)

        Returns:
            xr.Dataset with dims (time, lat, lon) and var 'precip_mm'
        """
        start = datetime.strptime(date_range[0], "%Y-%m-%d")
        end = datetime.strptime(date_range[1], "%Y-%m-%d")
        lat_min, lat_max, lon_min, lon_max = bbox

        # Download yearly files
        years = range(start.year, end.year + 1)
        datasets = []
        for year in years:
            path = self._download_year(year)
            ds = xr.open_dataset(path)

            # CHIRPS var name is typically 'precip'
            if "precip" in ds:
                ds = ds.rename({"precip": "precip_mm"})
            elif "precipitation" in ds:
                ds = ds.rename({"precipitation": "precip_mm"})

            # Standardize dim names
            if "latitude" in ds.dims:
                ds = ds.rename({"latitude": "lat", "longitude": "lon"})

            # Subset to India bbox
            ds = ds.sel(
                lat=slice(lat_min, lat_max),
                lon=slice(lon_min, lon_max),
            )
            datasets.append(ds)

        combined = xr.concat(datasets, dim="time")

        # Slice to exact date range
        combined = combined.sel(time=slice(date_range[0], date_range[1]))

        # Regrid from 0.05° to 0.25° (simple coarsen/block average)
        # 0.25 / 0.05 = 5, so coarsen by factor of 5
        combined = combined.coarsen(lat=5, lon=5, boundary="trim").mean()

        # Add metadata
        combined.attrs["source"] = "CHIRPS-2.0"
        combined.attrs["resolution_original"] = "0.05°"
        combined.attrs["resolution_regridded"] = "0.25°"

        return combined

    def source_metadata(self) -> dict:
        return {
            "name": "CHIRPS-2.0",
            "resolution": "0.05° (regridded to 0.25°)",
            "latency": "~3 weeks for final; ~2 days for preliminary",
            "license": "Public domain",
            "last_updated": datetime.utcnow().isoformat(),
        }
