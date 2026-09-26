import json
import requests
import pandas as pd
import joblib
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import libsql_client
import os
import time

TURSO_URL = os.environ.get("TURSO_URL", "https://meghdhrishti-abhinav29102005.aws-ap-northeast-1.turso.io")
TURSO_TOKEN = os.environ.get("TURSO_TOKEN", "")

# 1. Training coordinates (Representing different Indian climate zones)
TRAIN_CITIES = [
    {"name": "Mumbai", "lat": 19.07, "lon": 72.87},
    {"name": "Delhi", "lat": 28.61, "lon": 77.20},
    {"name": "Chennai", "lat": 13.08, "lon": 80.27},
    {"name": "Kolkata", "lat": 22.57, "lon": 88.36},
    {"name": "Guwahati", "lat": 26.14, "lon": 91.73},
]

def fetch_historical_data():
    print("Fetching historical weather data for training (Last 2 years)...")
    dfs = []
    for city in TRAIN_CITIES:
        url = f"https://archive-api.open-meteo.com/v1/archive?latitude={city['lat']}&longitude={city['lon']}&start_date=2024-01-01&end_date=2025-12-31&daily=temperature_2m_max,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum&timezone=Asia%2FKolkata"
        try:
            res = requests.get(url).json()
            if 'daily' in res:
                df = pd.DataFrame(res['daily'])
                df['city'] = city['name']
                dfs.append(df)
        except Exception as e:
            print(f"Failed to fetch {city['name']}: {e}")
        time.sleep(1) # Be nice to the free API
    
    if not dfs:
        raise ValueError("Could not fetch historical data.")
    
    full_df = pd.concat(dfs, ignore_index=True)
    
    # Feature Engineering: We want to predict tomorrow's rain based on today's weather
    full_df['target_precipitation'] = full_df.groupby('city')['precipitation_sum'].shift(-1)
    
    # Drop rows with NaN (the last day won't have a 'tomorrow')
    full_df = full_df.dropna()
    return full_df

def train_model(df):
    print("Training Random Forest Multivariate Model...")
    features = ['temperature_2m_max', 'relative_humidity_2m_mean', 'wind_speed_10m_max', 'precipitation_sum']
    X = df[features]
    y = df['target_precipitation']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    mse = mean_squared_error(y_test, preds)
    print(f"Model trained successfully! Test MSE: {mse:.2f}")
    return model

def extract_districts_from_geojson():
    print("Extracting districts from GeoJSON...")
    with open('frontend/public/india_districts.geojson', 'r') as f:
        data = json.load(f)
    
    districts = []
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        # Different geojson structures store names differently. We'll try common keys.
        dtname = props.get('NAME_2') or props.get('dtname') or props.get('DISTRICT') or props.get('name') or 'Unknown'
        stname = props.get('NAME_1') or props.get('stname') or props.get('STATE') or 'Unknown'
        
        # Approximate centroid from bounding box or just use polygon first coordinate
        geom = feature.get('geometry', {})
        coords = geom.get('coordinates', [])
        
        if not coords: continue
        
        # Very rough centroid extraction for the API call
        if geom['type'] == 'Polygon':
            poly = coords[0]
        elif geom['type'] == 'MultiPolygon':
            poly = coords[0][0]
        else:
            continue
            
        lon, lat = poly[0]
        districts.append({
            "id": f"{dtname}_{stname}".replace(" ", "_").lower(),
            "name": dtname,
            "state": stname,
            "lat": lat,
            "lon": lon
        })
    return districts

def fetch_current_weather_and_predict(model, districts):
    print(f"Fetching current weather for {len(districts)} districts and running inference...")
    
    # We batch requests to Open-Meteo (max 100 per request)
    batch_size = 50
    predictions = []
    
    for i in range(0, len(districts), batch_size):
        batch = districts[i:i+batch_size]
        lats = ",".join([str(d['lat']) for d in batch])
        lons = ",".join([str(d['lon']) for d in batch])
        
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lats}&longitude={lons}&daily=temperature_2m_max,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum&timezone=Asia%2FKolkata&forecast_days=1"
        
        try:
            res = requests.get(url).json()
            # Open-Meteo returns a list of responses if multiple coordinates are passed
            if isinstance(res, list):
                responses = res
            else:
                responses = [res]
                
            for j, data in enumerate(responses):
                if 'daily' not in data:
                    continue
                daily = data['daily']
                
                # Construct feature array for inference
                features = pd.DataFrame({
                    'temperature_2m_max': [daily['temperature_2m_max'][0]],
                    'relative_humidity_2m_mean': [daily['relative_humidity_2m_mean'][0]],
                    'wind_speed_10m_max': [daily['wind_speed_10m_max'][0]],
                    'precipitation_sum': [daily['precipitation_sum'][0]]
                })
                
                # Predict tomorrow's rainfall!
                predicted_rain = float(model.predict(features)[0])
                
                d = batch[j]
                
                # Determine category and probabilities logically
                cat = "No Rain"
                if predicted_rain > 115:
                    cat = "Extremely Heavy Rain"
                elif predicted_rain > 65:
                    cat = "Heavy Rain"
                elif predicted_rain > 15:
                    cat = "Moderate Rain"
                elif predicted_rain > 0:
                    cat = "Light Rain"
                    
                prob_65 = min(100.0, max(0.0, (predicted_rain / 65) * 100)) if predicted_rain > 20 else 0.0
                prob_115 = min(100.0, max(0.0, (predicted_rain / 115) * 100)) if predicted_rain > 50 else 0.0
                
                predictions.append({
                    "id": d['id'],
                    "district_name": d['name'],
                    "state": d['state'],
                    "lat": d['lat'],
                    "lon": d['lon'],
                    "raw_precip_mm": daily['precipitation_sum'][0], # Today's actual
                    "corrected_precip_mm": predicted_rain,          # ML Predicted for tomorrow
                    "heavy_rain_prob_65mm": prob_65,
                    "heavy_rain_prob_115mm": prob_115,
                    "category": cat,
                    "temperature": daily["temperature_2m_max"][0],
                    "humidity": daily["relative_humidity_2m_mean"][0],
                    "wind_speed": daily["wind_speed_10m_max"][0]
                })
        except Exception as e:
            print(f"Batch failed: {e}")
            
        time.sleep(1) # Rate limit protection
        
    return predictions

def push_to_turso(predictions):
    print(f"Pushing {len(predictions)} real ML predictions to Turso Database...")
    client = libsql_client.create_client_sync(url=TURSO_URL, auth_token=TURSO_TOKEN)
    
    # We don't drop the table, just clear the old mock data
    client.execute("DELETE FROM district_forecasts")
    
    for p in predictions:
        client.execute(
            """
            INSERT INTO district_forecasts (id, district_name, state, lat, lon, raw_precip_mm, corrected_precip_mm, heavy_rain_prob_65mm, heavy_rain_prob_115mm, category, temperature, humidity, wind_speed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                p['id'], p['district_name'], p['state'], p['lat'], p['lon'],
                p['raw_precip_mm'], p['corrected_precip_mm'],
                p['heavy_rain_prob_65mm'], p['heavy_rain_prob_115mm'],
                p['category'], p['temperature'], p['humidity'], p['wind_speed']
            ]
        )
    print("Database updated! The frontend will now show REAL ML data!")

if __name__ == "__main__":

    os.makedirs('data/raw', exist_ok=True)
    os.makedirs('data/processed', exist_ok=True)
    os.makedirs('data/models', exist_ok=True)

    # 1. Fetch 2 years of history
    hist_df = fetch_historical_data()
    hist_df.to_csv('data/raw/historical_weather_raw.csv', index=False)
    hist_df.dropna().to_csv('data/processed/training_features.csv', index=False)
    print('Saved training_data.csv to data/ folder.')
    
    # 2. Train the Random Forest
    rf_model = train_model(hist_df)
    joblib.dump(rf_model, 'data/models/random_forest_regressor.pkl')
    print('Saved trained model to data/models/')
    
    # 3. Get all Indian districts from the GeoJSON
    districts = extract_districts_from_geojson()
    
    # 4. Fetch today's weather & predict tomorrow
    final_preds = fetch_current_weather_and_predict(rf_model, districts)
    pd.DataFrame(final_preds).to_csv('data/processed/inference_results.csv', index=False)
    print('Saved predictions_data.csv to data/ folder.')
    
    # 5. Store on Turso
    push_to_turso(final_preds)
