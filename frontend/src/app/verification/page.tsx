"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVerificationSummary } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from "recharts";
import { motion } from "framer-motion";
import RegimeSwitcher from "@/components/RegimeSwitcher";

const fssData = [
  { neighborhood: 1, raw: 0.21, corrected: 0.34 },
  { neighborhood: 3, raw: 0.28, corrected: 0.43 },
  { neighborhood: 5, raw: 0.35, corrected: 0.53 },
  { neighborhood: 9, raw: 0.44, corrected: 0.73 },
  { neighborhood: 15, raw: 0.75, corrected: 0.98 },
  { neighborhood: 21, raw: 0.95, corrected: 0.98 },
];

const relData = [
  { forecast: 0.05, perfect: 0.05, observed: 0.05 },
  { forecast: 0.15, perfect: 0.15, observed: 0.15 },
  { forecast: 0.25, perfect: 0.25, observed: 0.25 },
  { forecast: 0.35, perfect: 0.35, observed: 0.35 },
  { forecast: 0.45, perfect: 0.45, observed: 0.45 },
  { forecast: 0.55, perfect: 0.55, observed: 0.55 },
  { forecast: 0.65, perfect: 0.65, observed: 0.65 },
  { forecast: 0.75, perfect: 0.75, observed: 0.75 },
  { forecast: 0.85, perfect: 0.85, observed: 0.85 },
  { forecast: 0.95, perfect: 0.95, observed: 0.95 },
];

export default function Verification() {
  const [regime, setRegime] = useState("active");
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["verification", regime], queryFn: () => fetchVerificationSummary(regime) });

  const etsData = data ? Object.entries(data.ets_by_threshold).map(([thr, v]) => ({ threshold: `>=${thr}mm`, raw: v.raw, corrected: v.corrected })) : [];

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.8px" }}>Verification Metrics</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.95rem", marginTop: 4 }}>Skill scores: Raw NWP vs AI-Corrected.</p>
        </div>
        <RegimeSwitcher regime={regime} setRegime={setRegime} />
      </div>
      
      {isLoading ? <div className="skel" style={{ height: 400 }} /> : isError ? (
        <div className="glass" role="alert" style={{ padding: 24 }}>
          <p>Verification metrics are not available for this regime yet.</p>
          <button onClick={() => refetch()} style={{ marginTop: 12 }}>Try again</button>
        </div>
      ) : data && (
        <div className="dashboard-grid">
          <motion.div className="glass" style={{ padding: 24, display: "flex", flexDirection: "column" }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 20 }}>Continuous Metrics</h3>
            <table className="data-tbl">
              <thead><tr><th>Metric</th><th>Raw</th><th>Corrected</th><th>Change</th></tr></thead>
              <tbody>
                {[{ lbl: "RMSE (mm)", r: data.rmse_raw, c: data.rmse_corrected }, { lbl: "MAE (mm)", r: data.mae_raw, c: data.mae_corrected }].map(row => {
                  const pct = ((row.r - row.c) / row.r * 100);
                  return (
                    <tr key={row.lbl}>
                      <td style={{ fontWeight: 500 }}>{row.lbl}</td>
                      <td>{row.r}</td>
                      <td style={{ color: "var(--accent)", fontWeight: 600 }}>{row.c}</td>
                      <td><span className={pct > 0 ? "improve" : "degrade"}>{pct > 0 ? "▼" : "▲"} {Math.abs(pct).toFixed(1)}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </motion.div>

          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 20 }}>Equitable Threat Score (ETS)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={etsData} barGap={8} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="threshold" tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 0.6]} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", borderRadius: 8, color: "#fff" }} itemStyle={{ color: "#fff" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                <Bar dataKey="raw" fill="var(--text-3)" name="Raw NWP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="corrected" fill="var(--accent)" name="AI-Corrected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 20 }}>Fractions Skill Score (illustrative)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={fssData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="neighborhood" tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", borderRadius: 8, color: "#fff" }} itemStyle={{ color: "#fff" }} />
                <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
                <Line type="monotone" dataKey="raw" stroke="var(--text-3)" strokeDasharray="5 5" name="Raw" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="corrected" stroke="var(--accent)" strokeWidth={3} name="Corrected" dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h3 className="section-title" style={{ fontSize: "1rem", marginBottom: 20 }}>Reliability Diagram (illustrative)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={relData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="forecast" tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fill: "var(--text-2)", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", borderRadius: 8, color: "#fff" }} itemStyle={{ color: "#fff" }} />
                <Line type="monotone" dataKey="perfect" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" name="Perfect" dot={false} />
                <Line type="monotone" dataKey="observed" stroke="var(--red)" strokeWidth={3} name="Corrected Model" dot={{ r: 4, fill: "var(--red)" }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </div>
  );
}
