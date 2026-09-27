"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCurrentRegime, fetchDistrictForecast } from "@/lib/api";
import RegimeIndicator from "@/components/RegimeIndicator";
import StatCard from "@/components/StatCard";
import DistrictTable from "@/components/DistrictTable";
import dynamic from "next/dynamic";
const RainfallMap = dynamic(() => import("@/components/RainfallMap"), { ssr: false });
import LeadSwitcher from "@/components/LeadSwitcher";

export default function Dashboard() {
  const [lead, setLead] = useState(24);

  const { data: regime, isLoading: regimeLoading } = useQuery({ queryKey: ["regime", "current"], queryFn: fetchCurrentRegime });
  const { data: forecasts, isLoading: forecastLoading } = useQuery({ queryKey: ["forecast", "district", lead], queryFn: () => fetchDistrictForecast(lead) });

  const stats = (forecasts && forecasts.length > 0) ? {
    avgRaw: forecasts.reduce((s, f) => s + f.raw_precip_mm, 0) / forecasts.length,
    avgCorr: forecasts.reduce((s, f) => s + f.corrected_precip_mm, 0) / forecasts.length,
    heavy: forecasts.filter(f => ["heavy", "very_heavy", "extremely_heavy"].includes((f.category || "").toLowerCase().replace(/ /g, "_"))).length,
  } : null;

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.8px" }}>MeghDrishti</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.95rem", marginTop: 4 }}>Real-time ML-corrected rainfall forecasts across India.</p>
        </div>
        <LeadSwitcher lead={lead} setLead={setLead} />
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 className="section-title">Atmospheric Context</h2>
        {regimeLoading ? <div className="skel" style={{ height: 110 }} /> : regime && <RegimeIndicator regime={regime} />}
      </section>

      {stats && (
        <section style={{ marginBottom: 40 }}>
          <h2 className="section-title">National Overview</h2>
          <div className="stats-grid">
            <StatCard label="Monitored Districts" value={forecasts?.length || 0} />
            <StatCard label="Avg Raw Prediction" value={stats.avgRaw} suffix="mm" />
            <StatCard label="Avg AI Corrected" value={stats.avgCorr} suffix="mm" color="var(--accent)" />
            <StatCard label="Heavy Rain Alerts" value={stats.heavy} color={stats.heavy > 0 ? "var(--red)" : "var(--green)"} />
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Regional Insights</h2>
        {forecastLoading ? <div className="skel" style={{ height: 600 }} /> : forecasts && (
          <div className="dashboard-grid">
            <div className="glass" style={{ height: "calc(100vh - 200px)", minHeight: 500, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--glass-border)", background: "var(--bg-secondary)", fontWeight: 600 }}>Forecast Data Table</div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <DistrictTable forecasts={forecasts} />
              </div>
            </div>
            <div className="glass" style={{ height: "calc(100vh - 200px)", minHeight: 500, overflow: "hidden", display: "flex", flexDirection: "column", background: "var(--bg-secondary)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--glass-border)", background: "var(--bg-secondary)", fontWeight: 600, zIndex: 10 }}>Spatial Intensity Map</div>
              <div style={{ flex: 1, position: "relative" }}>
                <RainfallMap forecasts={forecasts} />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
