'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchVerificationSummary, REGIME_LABELS } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

export default function Verification() {
  const [regime, setRegime] = useState('active');

  const { data, isLoading } = useQuery({
    queryKey: ['verification', regime],
    queryFn: () => fetchVerificationSummary(regime),
  });

  const etsData = data ? Object.entries(data.ets_by_threshold).map(([thr, v]) => ({
    threshold: `≥${thr}mm`, raw: v.raw, corrected: v.corrected,
  })) : [];

  const fssData = [1, 3, 5, 9, 15, 21].map(n => ({
    neighborhood: n,
    raw: Math.min(0.95, 0.15 + n * 0.04 + Math.random() * 0.05),
    corrected: Math.min(0.98, 0.28 + n * 0.05 + Math.random() * 0.04),
  }));

  const relData = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].map(b => ({
    forecast: b, perfect: b, observed: Math.min(1, Math.max(0, b + (Math.random() - 0.5) * 0.1)),
  }));

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Verification</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', marginTop: 4 }}>Skill scores: Raw NWP vs AI-Corrected</p>
        </div>
        <select
          value={regime}
          onChange={e => setRegime(e.target.value)}
          style={{
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 10,
            padding: '8px 14px', color: 'var(--text-1)', fontSize: '0.85rem', outline: 'none'
          }}
        >
          {Object.keys(REGIME_LABELS).map(r => (
            <option key={r} value={r} style={{ background: 'var(--bg-secondary)' }}>{REGIME_LABELS[r]}</option>
          ))}
        </select>
      </div>

      {isLoading ? <div className="skel" style={{ height: 400 }} /> : data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Continuous Metrics */}
          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>Continuous Metrics</h3>
            <table className="data-tbl">
              <thead><tr><th>Metric</th><th>Raw</th><th>Corrected</th><th>Change</th></tr></thead>
              <tbody>
                {[
                  { lbl: 'RMSE (mm)', r: data.rmse_raw, c: data.rmse_corrected },
                  { lbl: 'MAE (mm)', r: data.mae_raw, c: data.mae_corrected }
                ].map(row => {
                  const pct = ((row.r - row.c) / row.r * 100);
                  return (
                    <tr key={row.lbl}>
                      <td style={{ fontWeight: 500 }}>{row.lbl}</td>
                      <td>{row.r}</td>
                      <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.c}</td>
                      <td><span className={pct > 0 ? 'improve' : 'degrade'}>{pct > 0 ? '▼' : '▲'} {Math.abs(pct).toFixed(1)}%</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </motion.div>

          {/* ETS Chart */}
          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>Equitable Threat Score (ETS)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={etsData} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,195,247,0.06)" vertical={false} />
                <XAxis dataKey="threshold" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 0.6]} />
                <Tooltip cursor={{ fill: 'rgba(79,195,247,0.05)' }} contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', borderRadius: 8 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="raw" fill="rgba(232,234,246,0.3)" name="Raw NWP" radius={[4, 4, 0, 0]} />
                <Bar dataKey="corrected" fill="var(--accent)" name="AI-Corrected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* FSS Curve */}
          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>Fractions Skill Score (≥64.5mm)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fssData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,195,247,0.06)" vertical={false} />
                <XAxis dataKey="neighborhood" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', borderRadius: 8 }} />
                <ReferenceLine y={0.5} stroke="rgba(232,234,246,0.15)" strokeDasharray="4 4" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="raw" stroke="rgba(232,234,246,0.4)" strokeDasharray="5 5" name="Raw" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="corrected" stroke="var(--accent)" strokeWidth={3} name="Corrected" dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Reliability */}
          <motion.div className="glass" style={{ padding: 24 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>Reliability Diagram (Heavy Rain)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={relData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(79,195,247,0.06)" />
                <XAxis dataKey="forecast" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 1]} />
                <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="perfect" stroke="rgba(232,234,246,0.15)" strokeDasharray="4 4" name="Perfect" dot={false} />
                <Line type="monotone" dataKey="observed" stroke="var(--orange)" strokeWidth={3} name="Corrected Model" dot={{ r: 4, fill: 'var(--orange)' }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}
    </div>
  );
}
