"use client";
import React, { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DistrictForecast } from "@/lib/api";
import L from "leaflet";

interface Props {
  forecasts: DistrictForecast[];
}

type MetricType = "precip" | "prob_65" | "prob_115";

export default function RainfallMap({ forecasts }: Props) {
  const [geoData, setGeoData] = useState<any>(null);
  const [metric, setMetric] = useState<MetricType>("precip");

  useEffect(() => {
    fetch("/india_districts.geojson")
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(e => console.error("Failed to load geojson", e));
  }, []);

  const normalizeString = (str: string) => str.toLowerCase().replace(/[^a-z]/g, '');

  const forecastMap = useMemo(() => {
    const map: Record<string, DistrictForecast> = {};
    forecasts.forEach(f => {
      map[normalizeString(f.district_id)] = f;
      map[normalizeString(f.district_name)] = f;
    });
    return map;
  }, [forecasts]);

  const getColor = (f: DistrictForecast | undefined) => {
    if (!f) return "rgba(0,0,0,0.01)";
    if (metric === "precip") {
      const cat = f.category.toLowerCase().replace(' rain', '').replace(' ', '_');
      if (cat === "light") return "#0ea5e9";
      if (cat === "moderate") return "#3b82f6";
      if (cat === "heavy") return "#eab308";
      if (cat === "very_heavy") return "#f97316";
      if (cat === "extremely_heavy") return "#ef4444";
      return "rgba(0,0,0,0.01)";
    } else {
      const prob = metric === "prob_65" ? f.heavy_rain_prob_65mm : f.heavy_rain_prob_115mm;
      if (prob === null || prob === undefined) return "rgba(0,0,0,0.01)";
      if (prob < 0.1) return "rgba(14, 165, 233, 0.15)";
      if (prob < 0.3) return "#3b82f6";
      if (prob < 0.6) return "#eab308";
      if (prob < 0.8) return "#f97316";
      return "#ef4444";
    }
  };

  const styleFeature = (feature: any) => {
    const name1 = normalizeString(feature.properties?.dtname || "");
    const name2 = normalizeString(feature.properties?.NAME_2 || "");
    const name3 = normalizeString(feature.properties?.district || "");
    const f = forecastMap[name1] || forecastMap[name2] || forecastMap[name3];
    return {
      fillColor: getColor(f),
      weight: 0.5,
      opacity: 1,
      color: "rgba(0,0,0,0.15)",
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const name1 = normalizeString(feature.properties?.dtname || "");
    const name2 = normalizeString(feature.properties?.NAME_2 || "");
    const name3 = normalizeString(feature.properties?.district || "");
    const districtName = feature.properties?.dtname || feature.properties?.NAME_2 || "Unknown";
    const f = forecastMap[name1] || forecastMap[name2] || forecastMap[name3];
    
    layer.on({
      mouseover: (e: any) => {
        const lyr = e.target;
        lyr.setStyle({ weight: 2, color: "#0f172a", fillOpacity: 0.9 });
        lyr.bringToFront();
      },
      mouseout: (e: any) => {
        const lyr = e.target;
        lyr.setStyle(styleFeature(feature));
      }
    });

    if (f) {
      let tooltipContent = `<div style="font-family: sans-serif;"><strong>${f.district_name}, ${f.state}</strong><br/>`;
      if (metric === "precip") {
        tooltipContent += `Rainfall: ${f.corrected_precip_mm} mm/day<br/>Category: ${f.category}</div>`;
      } else {
        const prob = metric === "prob_65" ? f.heavy_rain_prob_65mm : f.heavy_rain_prob_115mm;
        tooltipContent += `Probability: ${prob ? (prob * 100).toFixed(1) + "%" : "N/A"}</div>`;
      }
      layer.bindTooltip(tooltipContent, { direction: "top", sticky: true, className: "custom-tooltip" });
    } else {
      layer.bindTooltip(`<div style="font-family: sans-serif;"><strong>${districtName}</strong><br/>No Data</div>`, { direction: "top", sticky: true, className: "custom-tooltip" });
    }
  };

  
  // Find top critical districts
  const criticalDistricts = useMemo(() => {
    return [...forecasts]
      .filter(f => f.heavy_rain_prob_65mm !== null && f.heavy_rain_prob_65mm > 0.6)
      .sort((a, b) => (b.heavy_rain_prob_65mm || 0) - (a.heavy_rain_prob_65mm || 0))
      .slice(0, 5);
  }, [forecasts]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 500, borderRadius: 16, overflow: "hidden", background: "#f8fafc" }}>
      
      
      {/* AI Actionable Alerts Panel */}
      {criticalDistricts.length > 0 && (
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 999, background: "var(--glass-bg)", padding: "16px", borderRadius: "12px", backdropFilter: "blur(10px)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--text-1)", display: "flex", flexDirection: "column", gap: "10px", width: "260px", boxShadow: "0 8px 32px rgba(239, 68, 68, 0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--red)", fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <span style={{ fontSize: "1.2rem" }}>🚨</span> AI Actionable Alerts
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 600, lineHeight: 1.4 }}>
            Disaster response staging recommended for the following districts:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            {criticalDistricts.map(d => (
              <div key={d.district_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(239, 68, 68, 0.1)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--red)" }}>{d.district_name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-3)", fontWeight: 600 }}>{d.state}</div>
                </div>
                <div style={{ fontWeight: 800, color: "var(--red)", fontSize: "0.95rem" }}>
                  {((d.heavy_rain_prob_65mm || 0) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric Toggle UI */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 999, display: "flex", gap: "8px", background: "var(--glass-bg)", padding: "8px", borderRadius: "12px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <button 
          onClick={() => setMetric("precip")}
          style={{ padding: "6px 12px", borderRadius: "8px", background: metric === "precip" ? "rgba(0,0,0,0.1)" : "transparent", color: "var(--text-1)", fontSize: "12px", border: "none", cursor: "pointer", transition: "0.2s" }}
        >
          Rainfall (mm/day)
        </button>
        <button 
          onClick={() => setMetric("prob_65")}
          style={{ padding: "6px 12px", borderRadius: "8px", background: metric === "prob_65" ? "rgba(0,0,0,0.1)" : "transparent", color: "var(--text-1)", fontSize: "12px", border: "none", cursor: "pointer", transition: "0.2s" }}
        >
          Prob &gt; 65mm
        </button>
        <button 
          onClick={() => setMetric("prob_115")}
          style={{ padding: "6px 12px", borderRadius: "8px", background: metric === "prob_115" ? "rgba(0,0,0,0.1)" : "transparent", color: "var(--text-1)", fontSize: "12px", border: "none", cursor: "pointer", transition: "0.2s" }}
        >
          Prob &gt; 115mm
        </button>
      </div>

      {/* Legend / Index */}
      <div style={{ position: "absolute", bottom: 24, left: 16, zIndex: 999, background: "var(--glass-bg)", padding: "12px", borderRadius: "12px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-1)", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>
          {metric === "precip" ? "Rainfall Category" : "Probability Scale"}
        </div>
        
        {metric === "precip" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#0ea5e9" }}></div> Light</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3b82f6" }}></div> Moderate</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#eab308" }}></div> Heavy</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f97316" }}></div> Very Heavy</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }}></div> Extremely Heavy</div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#0ea5e9" }}></div> &lt; 10%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3b82f6" }}></div> 10% - 30%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#eab308" }}></div> 30% - 60%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f97316" }}></div> 60% - 80%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }}></div> &gt; 80%</div>
          </>
        )}
      </div>

      <MapContainer
        center={[21.5937, 78.9629]}
        zoom={4.2}
        style={{ height: "100%", width: "100%", background: "#f8fafc" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="dark-tiles"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {geoData && (
          <GeoJSON 
            key={metric}
            data={geoData} 
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
        {/* Permanent Risk Labels on Map */}
        {criticalDistricts.map(f => f.lat && f.lon ? (
          <Marker key={`marker-${f.district_id}`} position={[f.lat, f.lon]} icon={L.divIcon({ className: "empty-icon", iconSize: [0,0] })}>
             <Tooltip permanent direction="center" className="high-risk-tooltip">
                <div style={{ textAlign: "center", lineHeight: "1.2" }}>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>{f.district_name}</div>
                  <div style={{ fontSize: "1rem" }}>{((f.heavy_rain_prob_65mm || 0) * 100).toFixed(0)}%</div>
                </div>
             </Tooltip>
          </Marker>
        ) : null)}

      </MapContainer>
    </div>
  );
}
