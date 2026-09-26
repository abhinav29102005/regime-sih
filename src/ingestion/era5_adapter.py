"""ERA5 reanalysis adapter.
Downloads MSLP, 850hPa winds, TCWV, OLR from Copernicus CDS.
Requires a free CDS account and ~/.cdsapirc configured.
Source: Copernicus Climate Data Store (cdsapi)
"""

import os
import logging
from datetime import datetime

import xarray as xr

from ingestion.base import DataSourceAdapter
from shared.config import RAW_DIR

logger = logging.getLogger(__name__)


class ERA5Adapter(DataSourceAdapter):
    """Fetches ERA5 reanalysis data for regime index computation."""

    def __init__(self, cache_dir: str = os.path.join(RAW_DIR, "era5")):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def fetch(self, date_range: tuple, bbox: tuple) -> xr.Dataset:
        """Fetch ERA5 variables needed for regime indices.

        Downloads: MSLP, U/V wind at 850hPa, TCWV (precipitable water).

        Args:
            date_range: (start_str, end_str)
            bbox: (lat_min, lat_max, lon_min, lon_max)

        Returns:
            xr.Dataset with dims (time, lat, lon) and vars:
                msl (mean sea level pressure),
                u850, v850 (wind components at 850hPa),
                tcwv (total column water vapour)
        """
        try:
            import cdsapi
        except ImportError:
            raise ImportError(
                "cdsapi not installed. Run: pip install cdsapi\n"
                "Also configure ~/.cdsapirc with your CDS API key.\n"
                "Register at: https://cds.climate.copernicus.eu/"
            )

        start = datetime.strptime(date_range[0], "%Y-%m-%d")
        end = datetime.strptime(date_range[1], "%Y-%m-%d")
        lat_min, lat_max, lon_min, lon_max = bbox

        client = cdsapi.Client()

        # ---- Single-level: MSLP + TCWV ----
        sl_file = os.path.join(
            self.cache_dir,
            f"era5_sl_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}.nc",
        )
        if not os.path.exists(sl_file):
            logger.info("Requesting ERA5 single-level data from CDS (may queue)...")
            client.retrieve(
                "reanalysis-era5-single-levels",
                {
                    "product_type": "reanalysis",
                    "variable": [
                        "mean_sea_level_pressure",
                        "total_column_water_vapour",
                    ],
                    "year": [str(y) for y in range(start.year, end.year + 1)],
                    "month": [f"{m:02d}" for m in range(start.month, end.month + 1)],
                    "day": [f"{d:02d}" for d in range(1, 32)],
                    "time": ["00:00", "06:00", "12:00", "18:00"],
                    "area": [lat_max, lon_min, lat_min, lon_max],  # N, W, S, E
                    "format": "netcdf",
                },
                sl_file,
            )
        ds_sl = xr.open_dataset(sl_file)

        # ---- Pressure-level: 850hPa wind ----
        pl_file = os.path.join(
            self.cache_dir,
            f"era5_pl_{start.strftime('%Y%m%d')}_{end.strftime('%Y%m%d')}.nc",
        )
        if not os.path.exists(pl_file):
            logger.info("Requesting ERA5 pressure-level data from CDS...")
            client.retrieve(
                "reanalysis-era5-pressure-levels",
                {
                    "product_type": "reanalysis",
                    "variable": [
                        "u_component_of_wind",
                        "v_component_of_wind",
                    ],
                    "pressure_level": "850",
                    "year": [str(y) for y in range(start.year, end.year + 1)],
                    "month": [f"{m:02d}" for m in range(start.month, end.month + 1)],
                    "day": [f"{d:02d}" for d in range(1, 32)],
                    "time": ["00:00", "06:00", "12:00", "18:00"],
                    "area": [lat_max, lon_min, lat_min, lon_max],
                    "format": "netcdf",
                },
                pl_file,
            )
        ds_pl = xr.open_dataset(pl_file)

        # Merge and standardize
        ds = xr.merge([ds_sl, ds_pl])

        # Standardize dim names
        rename_map = {}
        if "latitude" in ds.dims:
            rename_map["latitude"] = "lat"
        if "longitude" in ds.dims:
            rename_map["longitude"] = "lon"
        if rename_map:
            ds = ds.rename(rename_map)

        # Slice to exact date range
        ds = ds.sel(time=slice(date_range[0], date_range[1]))

        return ds

    def source_metadata(self) -> dict:
        return {
            "name": "ERA5 Reanalysis",
            "resolution": "0.25°",
            "latency": "~5 days for ERA5T, ~2 months for final",
            "license": "Copernicus License (free for research)",
            "last_updated": datetime.utcnow().isoformat(),
        }
