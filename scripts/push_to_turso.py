import pandas as pd
import libsql_client

TURSO_URL = "https://meghdhrishti-abhinav29102005.aws-ap-northeast-1.turso.io"
TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA0NTgwMTIsImlkIjoiMDFhMGRmOWQtMDkwMS03MTllLTlmYmMtZDAzZTNlNjhkZjI0Iiwia2lkIjoiYy1xeWVFV1NyU1hzQjBZQTZoQThEbFo2NmpUWldZZURFRmQ4aEduNVNNZyIsInJpZCI6IjJiYjc5YmNlLTk1OTItNGI5MC1hNWZlLWRjMTBkZDI4OWI0YSJ9.t5DkD1jQhL9EAZyqOnKARJgtzbS-EYM0JsWwSe28o1SxE57kPYt9zPizVncWOq5Y4Hy-Jz4hvE94i3q_XPg0DA"

df = pd.read_csv('data/processed/inference_results.csv')
predictions = df.to_dict('records')

print(f"Pushing {len(predictions)} real ML predictions to Turso Database...")
client = libsql_client.create_client_sync(url=TURSO_URL, auth_token=TURSO_TOKEN)

try:
    client.execute("DROP TABLE IF EXISTS district_forecasts")
    client.execute('''
        CREATE TABLE district_forecasts (
            id TEXT PRIMARY KEY,
            district_name TEXT,
            state TEXT,
            lat REAL,
            lon REAL,
            raw_precip_mm REAL,
            corrected_precip_mm REAL,
            heavy_rain_prob_65mm REAL,
            heavy_rain_prob_115mm REAL,
            category TEXT,
            temperature REAL,
            humidity REAL,
            wind_speed REAL,
            regime TEXT
        )
    ''')
except Exception as e:
    print(f"Error resetting table: {e}")

stmts = []
for p in predictions:
    stmts.append(
        libsql_client.Statement(
            """
            INSERT INTO district_forecasts (id, district_name, state, lat, lon, raw_precip_mm, corrected_precip_mm, heavy_rain_prob_65mm, heavy_rain_prob_115mm, category, temperature, humidity, wind_speed, regime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                p['id'], p['district_name'], p['state'], p['lat'], p['lon'],
                p['raw_precip_mm'], p['corrected_precip_mm'],
                p['heavy_rain_prob_65mm'], p['heavy_rain_prob_115mm'],
                p['category'], p['temperature'], p['humidity'], p['wind_speed'], p['regime']
            ]
        )
    )
for i in range(0, len(stmts), 100):
    client.batch(stmts[i:i+100])
    
print("Database updated!")
