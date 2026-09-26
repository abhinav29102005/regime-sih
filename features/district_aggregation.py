"""District-level aggregation from gridded data.
Loads India admin-2 boundaries and averages grid cells per district polygon.
"""

import numpy as np
import pandas as pd
import xarray as xr
import geopandas as gpd
from shapely.geometry import Point


def load_india_districts(shapefile_path: str | None = None) -> gpd.GeoDataFrame:
    """Load India admin-2 district boundaries.

    Sources (in priority order):
    1. Local shapefile path if provided
    2. GADM India level-2 from geodata.ucdavis.edu
    """
    if shapefile_path and shapefile_path.endswith((".shp", ".gpkg", ".geojson")):
        return gpd.read_file(shapefile_path)

    try:
        gdf = gpd.read_file(
            "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IND_2.json"
        )
        return gdf
    except Exception:
        raise FileNotFoundError(
            "Could not load India district boundaries. "
            "Download from https://gadm.org/download_country.html (India, level 2) "
            "and provide the file path."
        )


def aggregate_grid_to_districts(
    grid_data: xr.DataArray,
    districts: gpd.GeoDataFrame,
) -> pd.DataFrame:
    """Spatial average of gridded data per district polygon.

    Uses point-in-polygon assignment of grid centers to districts.
    """
    lats = grid_data.lat.values
    lons = grid_data.lon.values
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")

    points = gpd.GeoDataFrame(
        {
            "lat": lat_grid.ravel(),
            "lon": lon_grid.ravel(),
            "precip_mm": grid_data.values.ravel(),
        },
        geometry=[Point(x, y) for x, y in zip(lon_grid.ravel(), lat_grid.ravel())],
        crs="EPSG:4326",
    )

    joined = gpd.sjoin(points, districts, how="left", predicate="within")

    id_col = "NAME_2" if "NAME_2" in districts.columns else districts.columns[0]
    state_col = "NAME_1" if "NAME_1" in districts.columns else None

    agg_dict = {
        "precip_mm": "mean",
        "lat": "mean",
        "lon": "mean",
    }

    district_avg = joined.groupby(id_col).agg(agg_dict).reset_index()

    if state_col and state_col in joined.columns:
        state_map = joined.groupby(id_col)[state_col].first()
        district_avg["state"] = district_avg[id_col].map(state_map)

    return district_avg
