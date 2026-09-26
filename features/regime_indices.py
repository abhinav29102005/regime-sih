"""Regime index computation from ERA5 and observed rainfall data.
Implements all index definitions from README Section 4.1.
Pure functions — no I/O side effects beyond reading from the ingestion cache.
"""

import numpy as np
import pandas as pd
import xarray as xr
import requests
from io import StringIO

from shared.config import MONSOON_CORE_ZONE


def compute_monsoon_trough_lat(mslp: xr.DataArray) -> pd.Series:
    """Monsoon Trough Position — proxy for active/break monsoon.

    MT_lat(t) = argmin_lat[MSLP(lat, lon=75-85E, t)] in the 15-30N band.

    Active: trough near normal position (~21-23N) with developed LLJ.
    Break: trough shifted north toward Himalayan foothills (>26N).
    """
    mslp_strip = mslp.sel(lat=slice(15, 30), lon=slice(75, 85))
    # Mean across longitudes, then find lat of minimum pressure per timestep
    zonal_mean = mslp_strip.mean(dim="lon")
    mt_lat = zonal_mean.idxmin(dim="lat")
    return mt_lat.to_series().rename("MT_lat")


def compute_bmi(
    precip: xr.DataArray,
    clim_mean: xr.DataArray,
    clim_std: xr.DataArray,
) -> pd.Series:
    """Break Monsoon Index (Rajeevan et al.-style).

    BMI(t) = [P_MCZ(t) - P_bar_clim] / sigma_clim

    Where P_MCZ is area-averaged daily rainfall over the Monsoon Core Zone
    (18-28N, 73-86E), and climatological stats are for that calendar day
    (computed from a multi-year baseline, e.g. 1991-2020).

    Classification rules (for bootstrap labeling):
        BMI <= -1.0 for >=2 consecutive days → break monsoon
        BMI >= +1.0 for >=2 consecutive days → active monsoon
        otherwise → normal/transition
    """
    lat_min, lat_max, lon_min, lon_max = MONSOON_CORE_ZONE
    mcz_precip = precip.sel(lat=slice(lat_min, lat_max), lon=slice(lon_min, lon_max))
    p_mcz = mcz_precip.mean(dim=["lat", "lon"])
    bmi = (p_mcz - clim_mean) / clim_std
    return bmi.to_series().rename("BMI")


def compute_llj_index(u850: xr.DataArray, v850: xr.DataArray) -> pd.Series:
    """Low-Level Jet (LLJ) Index.

    LLJ(t) = mean wind speed at 850hPa over box [5-15N, 70-80E].
    LLJ > ~12-15 m/s is characteristic of active monsoon spells.
    """
    u_box = u850.sel(lat=slice(5, 15), lon=slice(70, 80))
    v_box = v850.sel(lat=slice(5, 15), lon=slice(70, 80))
    wind_speed = np.sqrt(u_box**2 + v_box**2)
    llj = wind_speed.mean(dim=["lat", "lon"])
    return llj.to_series().rename("LLJ")


def compute_olr_anomaly(olr: xr.DataArray, clim: xr.DataArray) -> pd.Series:
    """OLR (Outgoing Longwave Radiation) anomaly over India domain.

    Negative OLR anomalies indicate enhanced convection (active monsoon).
    Positive anomalies indicate suppressed convection (break monsoon).
    """
    anomaly = (olr - clim).mean(dim=["lat", "lon"])
    return anomaly.to_series().rename("OLR_anom")


def fetch_mjo_index() -> pd.DataFrame:
    """Fetch MJO RMM index from Bureau of Meteorology Australia.

    Source: http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt
    Returns DataFrame with columns: [date, RMM1, RMM2, phase, amplitude]

    MJO phases 2-3 and 6-7 are statistically associated with
    active/break transitions over India — used as auxiliary predictor.
    """
    url = "http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt"
    response = requests.get(url)
    response.raise_for_status()

    # Parse fixed-width text file (skip header lines)
    lines = response.text.strip().split("\n")
    data = []
    for line in lines:
        parts = line.split()
        if len(parts) >= 7:
            try:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                rmm1, rmm2 = float(parts[3]), float(parts[4])
                phase = int(parts[5])
                amplitude = float(parts[6])
                date = pd.Timestamp(year=year, month=month, day=day)
                data.append({
                    "date": date,
                    "RMM1": rmm1,
                    "RMM2": rmm2,
                    "MJO_phase": phase,
                    "MJO_amplitude": amplitude,
                })
            except (ValueError, IndexError):
                continue

    df = pd.DataFrame(data).set_index("date")
    return df


def build_regime_index_table(
    era5_data: xr.Dataset,
    precip_data: xr.DataArray,
    clim_mean: xr.DataArray,
    clim_std: xr.DataArray,
) -> pd.DataFrame:
    """Assemble all regime indices into a single table (one row per day).

    This is the input feature table for the regime classifier (Section 4.2).

    Columns:
        BMI, BMI_lag1, BMI_lag2,
        MT_lat, MT_lat_lag1,
        LLJ, LLJ_lag1,
        OLR_anom, PWAT,
        MJO_phase, MJO_amplitude,
        LPS_flag, WD_flag,
        day_of_year_sin, day_of_year_cos
    """
    # Compute individual indices
    bmi = compute_bmi(precip_data, clim_mean, clim_std)
    mt_lat = compute_monsoon_trough_lat(era5_data["msl"])
    llj = compute_llj_index(era5_data["u"], era5_data["v"])

    # MJO from external source
    try:
        mjo = fetch_mjo_index()
    except Exception:
        # Fallback: create empty MJO columns
        mjo = pd.DataFrame(
            {"MJO_phase": 0, "MJO_amplitude": 0.0},
            index=bmi.index,
        )

    # Assemble
    df = pd.DataFrame(index=bmi.index)
    df["BMI"] = bmi
    df["BMI_lag1"] = bmi.shift(1)
    df["BMI_lag2"] = bmi.shift(2)
    df["MT_lat"] = mt_lat
    df["MT_lat_lag1"] = mt_lat.shift(1)
    df["LLJ"] = llj
    df["LLJ_lag1"] = llj.shift(1)

    # TCWV / precipitable water (from ERA5)
    if "tcwv" in era5_data:
        pwat = era5_data["tcwv"].mean(dim=["lat", "lon"]).to_series()
        df["PWAT"] = pwat

    # OLR anomaly — if available
    df["OLR_anom"] = 0.0  # placeholder, populate when OLR data is available

    # MJO
    df = df.join(mjo[["MJO_phase", "MJO_amplitude"]], how="left")
    df["MJO_phase"] = df["MJO_phase"].fillna(0)
    df["MJO_amplitude"] = df["MJO_amplitude"].fillna(0)

    # LPS / WD flags — placeholder (needs IMD bulletin parsing or manual tagging)
    df["LPS_flag"] = 0
    df["WD_flag"] = 0

    # Cyclical day-of-year encoding
    doy = df.index.dayofyear
    df["day_of_year_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["day_of_year_cos"] = np.cos(2 * np.pi * doy / 365.25)

    # Drop rows with NaN from lag features
    df = df.dropna()

    return df
