'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentRegime, fetchDistrictForecast } from '@/lib/api';
import RegimeIndicator from '@/components/RegimeIndicator';
import StatCard from '@/components/StatCard';
import DistrictTable from '@/components/DistrictTable';
import RainfallMap from '@/components/RainfallMap';

export default function Dashboard() {
  const [lead, setLead] = useState(24);

  const { data: regime, isLoading: regimeLoading } = useQuery({
    queryKey: ['regime', 'current'],
    queryFn: fetchCurrentRegime,
    refetchInterval: 60000,
  });

  const { data: forecasts, isLoading: forecastLoading } = useQuery({
    queryKey: ['forecast', 'district', lead],
    queryFn: () => fetchDistrictForecast(lead),
  });

  const stats = forecasts ? {
    avgRaw: forecasts.reduce((s, f) => s + f.raw_precip_mm, 0) / forecasts.length,
    avgCorr: forecasts.reduce((s, f) => s + f.corrected_precip_mm, 0) / forecasts.length,
    heavy: forecasts.filter(f => ['heavy', 'very_heavy', 'extremely_heavy'].includes(f.category)).length,
  } : null;

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', marginTop: 4 }}>
            Real-time ML-corrected rainfall forecasts across India.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[12, 24, 48, 72].map(l => (
            <button key={l} className={`lead-btn ${lead === l ? 'active' : ''}`} onClick={() => setLead(l)}>
              T+{l}h
            </button>
          ))}
        </div>
      </div>

      {regimeLoading ? <div className="skel" style={{ height: 110, marginBottom: 20 }} /> : regime && <RegimeIndicator regime={regime} />}

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20, marginBottom: 20 }}>
          <StatCard label="Districts Monitored" value={forecasts?.length || 0} delay={0} />
          <StatCard label="Avg Raw Precip" value={stats.avgRaw} suffix="mm" delay={1} />
          <StatCard label="Avg Corrected" value={stats.avgCorr} suffix="mm" color="var(--accent)" delay={2} />
          <StatCard label="Heavy Rain Alerts" value={stats.heavy} color={stats.heavy > 0 ? 'var(--orange)' : 'var(--green)'} delay={3} />
        </div>
      )}

      {forecastLoading ? (
        <div className="skel" style={{ height: 450 }} />
      ) : forecasts && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, height: 'calc(100vh - 360px)', minHeight: 450 }}>
          <DistrictTable forecasts={forecasts} />
          <RainfallMap forecasts={forecasts} />
        </div>
      )}
    </div>
  );
}
