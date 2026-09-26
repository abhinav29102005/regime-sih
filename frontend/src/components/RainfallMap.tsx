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
    if (!f) return "rgba(255,255,255,0.02)";
    if (metric === "precip") {
      if (f.category === "light") return "#4ade80";
      if (f.category === "moderate") return "#60a5fa";
      if (f.category === "heavy") return "#fbbf24";
      if (f.category === "very_heavy") return "#f87171";
      if (f.category === "extremely_heavy") return "#dc2626";
      return "rgba(255,255,255,0.02)";
    } else {
      const prob = metric === "prob_65" ? f.heavy_rain_prob_65mm : f.heavy_rain_prob_115mm;
      if (prob === null || prob === undefined) return "rgba(255,255,255,0.02)";
      if (prob < 0.1) return "#4ade80";
      if (prob < 0.3) return "#60a5fa";
      if (prob < 0.6) return "#fbbf24";
      if (prob < 0.8) return "#f87171";
      return "#dc2626";
    }
  };

  const styleFeature = (feature: any) => {
    const districtName = (feature.properties?.dtname || feature.properties?.NAME_2 || "").toLowerCase();
    const f = forecastMap[districtName];
    return {
      fillColor: getColor(f),
      weight: 0.5,
      opacity: 1,
      color: "rgba(255,255,255,0.1)",
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const districtName = feature.properties?.dtname || feature.properties?.NAME_2 || "Unknown";
    const f = forecastMap[districtName.toLowerCase()];
    
    layer.on({
      mouseover: (e: any) => {
        const lyr = e.target;
        lyr.setStyle({ weight: 2, color: "#ffffff", fillOpacity: 0.9 });
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
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 500, borderRadius: 16, overflow: "hidden", background: "#000000" }}>
      
      {/* Metric Toggle UI */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 999, display: "flex", gap: "8px", background: "rgba(0,0,0,0.6)", padding: "8px", borderRadius: "12px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <button 
          onClick={() => setMetric("precip")}
          style={{ padding: "6px 12px", borderRadius: "8px", background: metric === "precip" ? "rgba(255,255,255,0.15)" : "transparent", color: "white", fontSize: "12px", border: "none", cursor: "pointer", transition: "0.2s" }}
        >
          Rainfall (mm/day)
        </button>
        <button 
          onClick={() => setMetric("prob_65")}
          style={{ padding: "6px 12px", borderRadius: "8px", background: metric === "prob_65" ? "rgba(255,255,255,0.15)" : "transparent", color: "white", fontSize: "12px", border: "none", cursor: "pointer", transition: "0.2s" }}
        >
          Prob &gt; 65mm
        </button>
        <button 
          onClick={() => setMetric("prob_115")}
          style={{ padding: "6px 12px", borderRadius: "8px", background: metric === "prob_115" ? "rgba(255,255,255,0.15)" : "transparent", color: "white", fontSize: "12px", border: "none", cursor: "pointer", transition: "0.2s" }}
        >
          Prob &gt; 115mm
        </button>
      </div>

      {/* Legend / Index */}
      <div style={{ position: "absolute", bottom: 24, left: 16, zIndex: 999, background: "rgba(0,0,0,0.7)", padding: "12px", borderRadius: "12px", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>
          {metric === "precip" ? "Rainfall Category" : "Probability Scale"}
        </div>
        
        {metric === "precip" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#4ade80" }}></div> Light</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#60a5fa" }}></div> Moderate</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fbbf24" }}></div> Heavy</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f87171" }}></div> Very Heavy</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#dc2626" }}></div> Extremely Heavy</div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#4ade80" }}></div> &lt; 10%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#60a5fa" }}></div> 10% - 30%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fbbf24" }}></div> 30% - 60%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#f87171" }}></div> 60% - 80%</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: "#dc2626" }}></div> &gt; 80%</div>
          </>
        )}
      </div>

      <MapContainer
        center={[21.5937, 78.9629]}
        zoom={4.2}
        style={{ height: "100%", width: "100%", background: "#000000" }}
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
