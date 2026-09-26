'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DistrictForecast } from '@/lib/api';

const RAIN_SCALE = [
  { max: 2, color: '#1a237e', label: '<2' },
  { max: 10, color: '#1565c0', label: '2-10' },
  { max: 25, color: '#42a5f5', label: '10-25' },
  { max: 50, color: '#66bb6a', label: '25-50' },
  { max: 75, color: '#fdd835', label: '50-75' },
  { max: 100, color: '#ffa726', label: '75-100' },
  { max: 150, color: '#ff7043', label: '100-150' },
  { max: 9999, color: '#ef5350', label: '150+' },
];

function getRainColor(mm: number) {
  for (const s of RAIN_SCALE) if (mm <= s.max) return s.color;
  return '#ef5350';
}

export default function RainfallMap({ forecasts }: { forecasts: DistrictForecast[] }) {
  const maxPrecip = useMemo(() => Math.max(...forecasts.map(f => f.corrected_precip_mm), 1), [forecasts]);

  return (
    <motion.div
      className="glass"
      style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Rainfall Map — India</h3>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
          {forecasts.length} districts
        </span>
      </div>
      <div style={{ flex: 1, position: 'relative', background: 'rgba(4, 8, 15, 0.6)', borderRadius: 12, overflow: 'hidden', minHeight: 380 }}>
        <svg viewBox="63 4 38 38" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          <path
            d="M68,8 L78,8 L80,10 L82,9 L85,10 L88,12 L92,14 L95,16 L97,18 L97,22 L95,25 L92,28 L88,30 L85,32 L82,34 L80,36 L78,38 L76,36 L74,34 L72,30 L70,26 L68,22 L66,18 L66,14 L67,10 Z"
            fill="rgba(79,195,247,0.03)" stroke="rgba(79,195,247,0.12)" strokeWidth="0.12"
          />
          {forecasts.map((f, i) => (
            <motion.circle
              key={f.district_id}
              cx={f.lon}
              cy={42 - f.lat}
              r={0.4 + (f.corrected_precip_mm / maxPrecip) * 0.9}
              fill={getRainColor(f.corrected_precip_mm)}
              opacity={0.88}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.06"
              initial={{ r: 0, opacity: 0 }}
              animate={{ r: 0.4 + (f.corrected_precip_mm / maxPrecip) * 0.9, opacity: 0.88 }}
              transition={{ delay: 0.4 + i * 0.015, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <title>{f.district_name}: {f.corrected_precip_mm.toFixed(1)} mm</title>
            </motion.circle>
          ))}
        </svg>
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(4,8,15,0.88)', borderRadius: 10, padding: '10px 14px',
          border: '1px solid var(--glass-border)',
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>mm/day</div>
          {RAIN_SCALE.map(({ color, label }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: '0.6rem', color: 'var(--text-2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
