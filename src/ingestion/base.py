"""Base adapter interface for all data sources.
Each data source (GFS, CHIRPS, ERA5, etc.) implements this interface,
ensuring sources are interchangeable without touching downstream modules.
"""

from abc import ABC, abstractmethod
import xarray as xr


class DataSourceAdapter(ABC):
    """Common interface all data sources must implement."""

    @abstractmethod
    def fetch(self, date_range: tuple, bbox: tuple) -> xr.Dataset:
        """Fetch data for the given date range and bounding box.

        Args:
            date_range: (start_date_str, end_date_str) e.g. ("2023-06-01", "2023-09-30")
            bbox: (lat_min, lat_max, lon_min, lon_max)

        Returns:
            xr.Dataset with standardized schema:
                dims: (time, lat, lon)
                variables: precip_mm, source_name, forecast_lead_hours (nullable for obs)
                coords: WGS84
        """
        ...

    @abstractmethod
    def source_metadata(self) -> dict:
        """Returns metadata about this data source.

        Returns:
            dict with keys: name, resolution, latency, license, last_updated
        """
        ...
