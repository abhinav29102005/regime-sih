"""Grid-level and district-level predictor table construction.
Builds the feature matrices used by the bias correction engine (Section 5.2).
"""

import numpy as np
import pandas as pd
import xarray as xr
import geopandas as gpd


def build_grid_predictor_table(
    gfs_data: xr.DataArray,
    regime_probs: dict[str, float],
    elevation: xr.DataArray | None = None,
    coastline_dist: xr.DataArray | None = None,
    lead_hours: int = 24,
) -> pd.DataFrame:
    """Build per-grid-cell feature table for the correction model.

    One row per (time, lat, lon). Columns:
        raw_nwp_precip, elevation, dist_to_coast, terrain_slope,
        regime_prob_active, ..., regime_prob_normal,
        lead_time_hours, surrounding_8_mean (spatial context)
    """
    # Flatten grid to DataFrame
    stacked = gfs_data.stack(grid=("lat", "lon"))
    df = stacked.to_dataframe(name="raw_nwp_precip").reset_index()

    # Regime probabilities (broadcast to all rows)
    for regime, prob in regime_probs.items():
        df[f"regime_prob_{regime}"] = prob

    # Lead time
    df["lead_time_hours"] = lead_hours

    # Terrain features (static)
    if elevation is not None:
        elev_stacked = elevation.stack(grid=("lat", "lon")).to_dataframe(name="elevation")
        df = df.merge(elev_stacked, on=["lat", "lon"], how="left")
        df["elevation"] = df["elevation"].fillna(0)
    else:
        df["elevation"] = 0.0

    if coastline_dist is not None:
        coast_stacked = coastline_dist.stack(grid=("lat", "lon")).to_dataframe(name="dist_to_coast")
        df = df.merge(coast_stacked, on=["lat", "lon"], how="left")
    else:
        df["dist_to_coast"] = 100.0  # placeholder

    return df


def load_india_districts(shapefile_path: str | None = None) -> gpd.GeoDataFrame:
    """Load India admin-2 district boundaries.

    Sources (in priority order):
    1. Local shapefile path if provided
    2. GADM India (download from gadm.org)
    3. geoBoundaries (alternative)
    """
    if shapefile_path and shapefile_path.endswith((".shp", ".gpkg", ".geojson")):
        return gpd.read_file(shapefile_path)

    # Try GADM
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

    Uses simple point-in-polygon assignment of grid centers to districts.
    """
    # Create point GeoDataFrame from grid centers
    lats = grid_data.lat.values
    lons = grid_data.lon.values
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij")

    from shapely.geometry import Point

    points = gpd.GeoDataFrame(
        {
            "lat": lat_grid.ravel(),
            "lon": lon_grid.ravel(),
            "precip_mm": grid_data.values.ravel(),
        },
        geometry=[Point(x, y) for x, y in zip(lon_grid.ravel(), lat_grid.ravel())],
        crs="EPSG:4326",
    )

    # Spatial join: assign each grid point to a district
    joined = gpd.sjoin(points, districts, how="left", predicate="within")

    # Aggregate per district
    id_col = "NAME_2" if "NAME_2" in districts.columns else districts.columns[0]
    district_avg = joined.groupby(id_col).agg(
        precip_mm=("precip_mm", "mean"),
        lat=("lat", "mean"),
        lon=("lon", "mean"),
    ).reset_index()

    return district_avg
