import { useState } from 'react';
import { useVerificationSummary } from '../hooks/useData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';

const REGIMES = ['active', 'break', 'depression', 'western_disturbance', 'normal'];

export default function Verification() {
  const [selectedRegime, setSelectedRegime] = useState('active');
  const { data, isLoading } = useVerificationSummary(selectedRegime);

  const improvement = (raw: number, corrected: number) => {
    const pct = ((raw - corrected) / raw * 100).toFixed(0);
    return { pct: `${pct}%`, isGood: corrected < raw };
  };

  // Mock FSS curve data
  const fssData = [1, 3, 5, 9, 15, 21].map((n) => ({
    neighborhood: n,
    raw: Math.min(0.95, 0.15 + n * 0.04 + Math.random() * 0.05),
    corrected: Math.min(0.98, 0.28 + n * 0.05 + Math.random() * 0.04),
  }));

  // ETS bar chart data
  const etsData = data
    ? Object.entries(data.ets_by_threshold).map(([threshold, vals]) => ({
        threshold: `≥${threshold}mm`,
        raw: vals.raw,
        corrected: vals.corrected,
      }))
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Verification Report</h1>
          <p>Raw NWP vs. AI-Corrected forecast skill comparison</p>
        </div>
        <select
          className="regime-filter"
          value={selectedRegime}
          onChange={(e) => setSelectedRegime(e.target.value)}
        >
          {REGIMES.map((r) => (
            <option key={r} value={r}>{r.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: 400 }} />
      ) : data ? (
        <>
          {/* Continuous Metrics Table */}
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="glass-card animate-in">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>Continuous Metrics</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Raw NWP</th>
                    <th>AI-Corrected</th>
                    <th>Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'RMSE (mm)', raw: data.rmse_raw, corr: data.rmse_corrected },
                    { label: 'MAE (mm)', raw: data.mae_raw, corr: data.mae_corrected },
                  ].map((row) => {
                    const imp = improvement(row.raw, row.corr);
                    return (
                      <tr key={row.label}>
                        <td style={{ fontWeight: 500 }}>{row.label}</td>
                        <td>{row.raw}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{row.corr}</td>
                        <td>
                          <span className={`metric-improvement ${imp.isGood ? 'good' : 'bad'}`}>
                            {imp.isGood ? '▼' : '▲'} {imp.pct}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ETS Bar Chart */}
            <div className="glass-card animate-in">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
                ETS by Threshold
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={etsData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,195,247,0.08)" />
                  <XAxis dataKey="threshold" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0, 0.6]} />
                  <Tooltip
                    contentStyle={{ background: '#0a1128', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 8, fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="raw" fill="rgba(150,150,150,0.5)" name="Raw NWP" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="corrected" fill="var(--accent-primary)" name="AI-Corrected" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FSS Curve + Reliability */}
          <div className="grid-2">
            <div className="glass-card animate-in">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
                FSS Curve (≥64.5mm)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={fssData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,195,247,0.08)" />
                  <XAxis dataKey="neighborhood" label={{ value: 'Neighborhood (grid cells)', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#0a1128', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 8, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.2)" strokeDasharray="6 4" label={{ value: 'Useful Skill', fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Line type="monotone" dataKey="raw" stroke="rgba(150,150,150,0.6)" strokeDasharray="6 3" name="Raw NWP" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="corrected" stroke="var(--accent-primary)" strokeWidth={2} name="AI-Corrected" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card animate-in">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
                Reliability Diagram (Heavy Rain)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={[0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].map((bin) => ({
                  forecast: bin,
                  observed: Math.min(1, bin + (Math.random() - 0.5) * 0.15),
                  perfect: bin,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,195,247,0.08)" />
                  <XAxis dataKey="forecast" label={{ value: 'Forecast Probability', position: 'insideBottom', offset: -5, fill: 'var(--text-muted)', fontSize: 11 }} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis domain={[0, 1]} label={{ value: 'Observed Freq', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#0a1128', border: '1px solid rgba(79,195,247,0.2)', borderRadius: 8, fontSize: 13 }} />
                  <Line type="monotone" dataKey="perfect" stroke="rgba(255,255,255,0.15)" strokeDasharray="6 3" dot={false} name="Perfect" />
                  <Line type="monotone" dataKey="observed" stroke="var(--accent-primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--accent-primary)' }} name="Model" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
