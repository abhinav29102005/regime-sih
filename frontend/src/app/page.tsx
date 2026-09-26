'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentRegime, fetchDistrictForecast } from '@/lib/api';
import RegimeIndicator from '@/components/RegimeIndicator';
import StatCard from '@/components/StatCard';
import DistrictTable from '@/components/DistrictTable';
import RainfallMap from '@/components/RainfallMap';
import LeadSwitcher from '@/components/LeadSwitcher';

export default function Dashboard() {
  const [lead, setLead] = useState(24);

  const { data: regime, isLoading: regimeLoading } = useQuery({ queryKey: ['regime', 'current'], queryFn: fetchCurrentRegime });
  const { data: forecasts, isLoading: forecastLoading } = useQuery({ queryKey: ['forecast', 'district', lead], queryFn: () => fetchDistrictForecast(lead) });

  const stats = forecasts ? {
    avgRaw: forecasts.reduce((s, f) => s + f.raw_precip_mm, 0) / forecasts.length,
    avgCorr: forecasts.reduce((s, f) => s + f.corrected_precip_mm, 0) / forecasts.length,
    heavy: forecasts.filter(f => ['heavy', 'very_heavy', 'extremely_heavy'].includes(f.category)).length,
  } : null;

  return (
    <div className='page-enter'>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Forecast Dashboard</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginTop: 4 }}>Real-time ML-corrected rainfall forecasts.</p>
        </div>
        <LeadSwitcher lead={lead} setLead={setLead} />
      </div>
      {regimeLoading ? <div className='skel' style={{ height: 110, marginBottom: 24 }} /> : regime && <RegimeIndicator regime={regime} />}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 24 }}>
          <StatCard label='Districts' value={forecasts?.length || 0} />
          <StatCard label='Avg Raw' value={stats.avgRaw} suffix='mm' />
          <StatCard label='Avg Corrected' value={stats.avgCorr} suffix='mm' color='var(--accent)' />
          <StatCard label='Heavy Alerts' value={stats.heavy} color={stats.heavy > 0 ? 'var(--orange)' : 'var(--green)'} />
        </div>
      )}
      {forecastLoading ? <div className='skel' style={{ height: 500 }} /> : forecasts && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, minHeight: 500 }}>
          <DistrictTable forecasts={forecasts} />
          <RainfallMap forecasts={forecasts} />
        </div>
      )}
    </div>
  );
}
