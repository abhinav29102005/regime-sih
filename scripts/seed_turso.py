import asyncio
import os
import sys

# Ensure the api package can be imported
sys.path.append(os.getcwd())

import libsql_client
from api.mock_data import mock_district_forecasts

URL = "https://meghdhrishti-abhinav29102005.aws-ap-northeast-1.turso.io"
TOKEN = ""

async def main():
    print("Generating CHIRPS forecasts...")
    forecasts = mock_district_forecasts()
    print(f"Generated {len(forecasts)} forecasts.")

    print("Connecting to Turso...")
    client = libsql_client.create_client_sync(url=URL, auth_token=TOKEN)

    print("Creating table...")
    client.execute("""
        CREATE TABLE IF NOT EXISTS district_forecasts (
            id TEXT PRIMARY KEY,
            district_name TEXT,
            state TEXT,
            lat REAL,
            lon REAL,
            raw_precip_mm REAL,
            corrected_precip_mm REAL,
            heavy_rain_prob_65mm REAL,
            heavy_rain_prob_115mm REAL,
            category TEXT
        )
    """)

    print("Clearing old data...")
    client.execute("DELETE FROM district_forecasts")

    print("Inserting new data...")
    for f in forecasts:
        client.execute(
            """
            INSERT INTO district_forecasts (id, district_name, state, lat, lon, raw_precip_mm, corrected_precip_mm, heavy_rain_prob_65mm, heavy_rain_prob_115mm, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                f.district_id, f.district_name, f.state, f.lat, f.lon,
                f.raw_precip_mm, f.corrected_precip_mm,
                f.heavy_rain_prob_65mm, f.heavy_rain_prob_115mm,
                f.category
            ]
        )
    
    print("Data seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
