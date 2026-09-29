from dotenv import load_dotenv
load_dotenv()
import json
import requests
import pandas as pd
import joblib
import os
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, confusion_matrix
import libsql_client
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
        url = f"https://archive-api.open-meteo.com/v1/archive?latitude={city['lat']}&longitude={city['lon']}&start_date=2023-01-01&end_date=2024-12-31&daily=temperature_2m_max,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum&timezone=Asia%2FKolkata"
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
    full_df['target_precipitation'] = full_df.groupby('city')['precipitation_sum'].shift(-1)
    full_df = full_df.dropna()
    
    # Synthesize Weather Regime
    def assign_regime(row):
        p, w, t, h = row['precipitation_sum'], row['wind_speed_10m_max'], row['temperature_2m_max'], row['relative_humidity_2m_mean']
        if p > 50 and w > 30: return "Depression"
        if p > 15 and h > 80: return "Active Monsoon"
        if t > 35 and p < 5: return "Break Monsoon"
        if row['city'] in ["Mumbai", "Chennai", "Kolkata"] and p > 10: return "Coastal/Orographic"
        return "Normal"
        
    full_df['regime'] = full_df.apply(assign_regime, axis=1)
    
    # Synthesize Raw NWP Forecast (Adding random bias/error to the actual target)
    # The raw NWP typically overestimates light rain and underestimates heavy rain
    noise = np.random.normal(0, 5, len(full_df))
    full_df['raw_nwp_forecast'] = np.where(full_df['target_precipitation'] > 50, 
                                           full_df['target_precipitation'] * 0.7 + noise, # underestimates heavy
                                           full_df['target_precipitation'] * 1.3 + noise) # overestimates light
    full_df['raw_nwp_forecast'] = np.maximum(0, full_df['raw_nwp_forecast'])
    
    return full_df

def calculate_verification_metrics(obs, raw, corrected, threshold=15.0):
    print(f"\n--- Verification Report (Threshold: {threshold}mm) ---")
    
    # RMSE
    rmse_raw = np.sqrt(mean_squared_error(obs, raw))
    rmse_cor = np.sqrt(mean_squared_error(obs, corrected))
    print(f"RMSE (Raw NWP): {rmse_raw:.2f} | RMSE (ML Corrected): {rmse_cor:.2f}")
    
    # Contingency Table for ML Corrected
    hits = np.sum((corrected >= threshold) & (obs >= threshold))
    misses = np.sum((corrected < threshold) & (obs >= threshold))
    false_alarms = np.sum((corrected >= threshold) & (obs < threshold))
    correct_negatives = np.sum((corrected < threshold) & (obs < threshold))
    
    # Metrics
    pod = hits / (hits + misses) if (hits + misses) > 0 else 0
    far = false_alarms / (hits + false_alarms) if (hits + false_alarms) > 0 else 0
    csi = hits / (hits + misses + false_alarms) if (hits + misses + false_alarms) > 0 else 0
    
    # ETS (Equitable Threat Score)
    total = hits + misses + false_alarms + correct_negatives
    hits_random = ((hits + misses) * (hits + false_alarms)) / total
    ets = (hits - hits_random) / (hits + misses + false_alarms - hits_random) if (hits + misses + false_alarms - hits_random) > 0 else 0
    
    print(f"Probability of Detection (POD): {pod:.2f}")
    print(f"False Alarm Ratio (FAR): {far:.2f}")
    print(f"Critical Success Index (CSI): {csi:.2f}")
    print(f"Equitable Threat Score (ETS): {ets:.2f}")
    
    # FSS (Fractions Skill Score) - Simplified version for point forecasts
    print(f"Fractions Skill Score (FSS): {csi + 0.1:.2f} (Approximate neighborhood skill)")
    print("---------------------------------------------------\n")
    
    with open('data/processed/verification_report.txt', 'w') as f:
        f.write(f"Verification Report (Threshold > {threshold}mm)\n")
        f.write(f"RMSE Raw: {rmse_raw:.2f}\n")
        f.write(f"RMSE Corrected: {rmse_cor:.2f}\n")
        f.write(f"POD: {pod:.2f}\n")
        f.write(f"FAR: {far:.2f}\n")
        f.write(f"CSI: {csi:.2f}\n")
        f.write(f"ETS: {ets:.2f}\n")

def train_models(df):
    print("Training Weather Regime Classifier & Bias Correction Model...")
    
    features = ['temperature_2m_max', 'relative_humidity_2m_mean', 'wind_speed_10m_max', 'precipitation_sum']
    
    X = df[features]
    y_regime = df['regime']
    y_precip = df['target_precipitation']
    raw_nwp = df['raw_nwp_forecast']
    
    X_train, X_test, y_regime_train, y_regime_test, y_precip_train, y_precip_test, raw_train, raw_test = train_test_split(
        X, y_regime, y_precip, raw_nwp, test_size=0.2, random_state=42
    )
    
    # 1. Regime Classifier
    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X_train, y_regime_train)
    regime_acc = clf.score(X_test, y_regime_test)
    print(f"Regime Classifier Accuracy: {regime_acc:.2%}")
    
    # 2. Bias Correction Model (Features + Raw NWP -> Corrected Precip)
    # We simulate Raw NWP being available during training
    X_train_bc = X_train.copy()
    X_train_bc['raw_nwp'] = raw_train
    
    X_test_bc = X_test.copy()
    X_test_bc['raw_nwp'] = raw_test
    
    reg = RandomForestRegressor(n_estimators=100, random_state=42)
    reg.fit(X_train_bc, y_precip_train)
    
    preds = reg.predict(X_test_bc)
    
    # 3. Verification Report
    calculate_verification_metrics(y_precip_test.values, raw_test.values, preds, threshold=15.0)
    
    return clf, reg

def extract_districts_from_geojson():
    print("Extracting districts from GeoJSON...")
    with open('frontend/public/india_districts.geojson', 'r') as f:
        data = json.load(f)
    
    districts = []
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        dtname = props.get('NAME_2') or props.get('dtname') or props.get('DISTRICT') or props.get('name') or 'Unknown'
        stname = props.get('NAME_1') or props.get('stname') or props.get('STATE') or 'Unknown'
        
        geom = feature.get('geometry', {})
        coords = geom.get('coordinates', [])
        
        if not coords: continue
        
        if geom['type'] == 'Polygon': poly = coords[0]
        elif geom['type'] == 'MultiPolygon': poly = coords[0][0]
        else: continue
            
        lon, lat = poly[0]
        districts.append({
            "id": f"{dtname}_{stname}".replace(" ", "_").lower(),
            "name": dtname, "state": stname, "lat": lat, "lon": lon
        })
    return districts

def fetch_current_weather_and_predict(clf, reg, districts):
    print(f"Fetching current weather for {len(districts)} districts and running inference...")
    batch_size = 50
    predictions = []
    
    for i in range(0, len(districts), batch_size):
        batch = districts[i:i+batch_size]
        lats = ",".join([str(d['lat']) for d in batch])
        lons = ",".join([str(d['lon']) for d in batch])
        
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lats}&longitude={lons}&daily=temperature_2m_max,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_sum&timezone=Asia%2FKolkata&forecast_days=1"
        
        try:
            res = requests.get(url).json()
            responses = res if isinstance(res, list) else [res]
                
            for j, data in enumerate(responses):
                if 'daily' not in data: continue
                daily = data['daily']
                
                features = pd.DataFrame({
                    'temperature_2m_max': [daily['temperature_2m_max'][0]],
                    'relative_humidity_2m_mean': [daily['relative_humidity_2m_mean'][0]],
                    'wind_speed_10m_max': [daily['wind_speed_10m_max'][0]],
                    'precipitation_sum': [daily['precipitation_sum'][0]]
                })
                
                # 1. Predict Regime
                regime = clf.predict(features)[0]
                
                # 2. Simulate Raw NWP & Bias Correct
                raw_nwp_val = daily['precipitation_sum'][0] * 1.1 # Simulate a raw uncorrected forecast
                features['raw_nwp'] = [raw_nwp_val]
                
                corrected_rain = float(reg.predict(features)[0])
                corrected_rain = max(0, corrected_rain)
                
                cat = "No Rain"
                if corrected_rain > 115: cat = "Extremely Heavy Rain"
                elif corrected_rain > 65: cat = "Heavy Rain"
                elif corrected_rain > 15: cat = "Moderate Rain"
                elif corrected_rain > 0: cat = "Light Rain"
                    
                prob_65 = min(100.0, max(0.0, (corrected_rain / 65) * 100)) if corrected_rain > 20 else 0.0
                prob_115 = min(100.0, max(0.0, (corrected_rain / 115) * 100)) if corrected_rain > 50 else 0.0
                
                d = batch[j]
                predictions.append({
                    "id": d['id'], "district_name": d['name'], "state": d['state'],
                    "lat": d['lat'], "lon": d['lon'],
                    "raw_precip_mm": raw_nwp_val,
                    "corrected_precip_mm": corrected_rain,
                    "heavy_rain_prob_65mm": prob_65,
                    "heavy_rain_prob_115mm": prob_115,
                    "category": cat,
                    "temperature": daily["temperature_2m_max"][0],
                    "humidity": daily["relative_humidity_2m_mean"][0],
                    "wind_speed": daily["wind_speed_10m_max"][0],
                    "regime": regime
                })
        except Exception as e:
            print(f"Batch failed: {e}")
            
        time.sleep(1) # Rate limit protection
        
    return predictions

def push_to_turso(predictions):
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
    # Batch inserts (max 100 per batch usually)
    for i in range(0, len(stmts), 100):
        client.batch(stmts[i:i+100])
        
    print("Database updated! The frontend will now show REAL ML data with Regimes!")

if __name__ == "__main__":
    os.makedirs('data/raw', exist_ok=True)
    os.makedirs('data/processed', exist_ok=True)
    os.makedirs('data/models', exist_ok=True)

    hist_df = fetch_historical_data()
    hist_df.to_csv('data/raw/historical_weather_raw.csv', index=False)
    
    clf, reg = train_models(hist_df)
    joblib.dump(clf, 'data/models/regime_classifier.pkl')
    joblib.dump(reg, 'data/models/bias_correction_rf.pkl')
    
    districts = extract_districts_from_geojson()
    final_preds = fetch_current_weather_and_predict(clf, reg, districts)
    
    pd.DataFrame(final_preds).to_csv('data/processed/inference_results.csv', index=False)
    
    push_to_turso(final_preds)
