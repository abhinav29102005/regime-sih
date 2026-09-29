"use client";
import React, { useMemo, useState, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
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

  const forecastMap = useMemo(() => {
    const map: Record<string, DistrictForecast> = {};
    forecasts.forEach(f => {
      map[f.district_id.toLowerCase()] = f;
      map[f.district_name.toLowerCase()] = f;
    });
    return map;
  }, [forecasts]);

  const getColor = (f: DistrictForecast | undefined) => {
    if (!f) return "rgba(0,0,0,0.02)";
    if (metric === "precip") {
      const cat = f.category.toLowerCase().replace(' rain', '').replace(' ', '_');
      if (cat === "light") return "#22c55e";
      if (cat === "moderate") return "#3b82f6";
      if (cat === "heavy") return "#f59e0b";
      if (cat === "very_heavy") return "#ef4444";
      if (cat === "extremely_heavy") return "#b91c1c";
      return "rgba(0,0,0,0.02)";
    } else {
      const prob = metric === "prob_65" ? f.heavy_rain_prob_65mm : f.heavy_rain_prob_115mm;
      if (prob === null || prob === undefined) return "rgba(0,0,0,0.02)";
      if (prob < 0.1) return "rgba(34, 197, 94, 0.3)"; // Faint green for very low prob
      if (prob < 0.3) return "#3b82f6";
      if (prob < 0.6) return "#f59e0b";
      if (prob < 0.8) return "#ef4444";
      return "#b91c1c";
    }
  };

  const styleFeature = (feature: any) => {
    const districtName = (feature.properties?.dtname || feature.properties?.NAME_2 || "").toLowerCase();
    const f = forecastMap[districtName];
    return {
      fillColor: getColor(f),
      weight: 0.5,
      opacity: 1,
      color: "rgba(0,0,0,0.15)",
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const districtName = feature.properties?.dtname || feature.properties?.NAME_2 || "Unknown";
    const f = forecastMap[districtName.toLowerCase()];
    
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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 500, borderRadius: 16, overflow: "hidden", background: "#f8fafc" }}>
      
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }}></div> Light</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3b82f6" }}></div> Moderate</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }}></div> Heavy</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }}></div> Very Heavy</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#b91c1c" }}></div> Extremely Heavy</div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#22c55e" }}></div> &lt; 10%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#3b82f6" }}></div> 10% - 30%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b" }}></div> 30% - 60%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444" }}></div> 60% - 80%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#b91c1c" }}></div> &gt; 80%</div>
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
      </MapContainer>
    </div>
  );
}
