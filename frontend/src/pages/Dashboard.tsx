import { useState } from 'react';
import { useCurrentRegime, useDistrictForecast } from '../hooks/useData';
import RegimeIndicator from '../components/RegimeIndicator';
import DistrictTable from '../components/DistrictTable';
import DistrictMap from '../components/DistrictMap';

const LEAD_TIMES = [6, 12, 24, 48, 72];

export default function Dashboard() {
  const [leadTime, setLeadTime] = useState(24);
  const { data: regime, isLoading: regimeLoading } = useCurrentRegime();
  const { data: forecasts, isLoading: forecastLoading } = useDistrictForecast(leadTime);

  const stats = forecasts
    ? {
        avgRaw: (forecasts.reduce((s, f) => s + f.raw_precip_mm, 0) / forecasts.length).toFixed(1),
        avgCorrected: (forecasts.reduce((s, f) => s + f.corrected_precip_mm, 0) / forecasts.length).toFixed(1),
        heavyCount: forecasts.filter((f) => f.category === 'heavy' || f.category === 'very_heavy' || f.category === 'extremely_heavy').length,
        districts: forecasts.length,
      }
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Monsoon Forecast Dashboard</h1>
          <p>Regime-Aware AI Post-Processing • Real-time corrected rainfall forecasts</p>
        </div>
      </div>

      {/* Regime Indicator */}
      {regimeLoading ? (
        <div className="skeleton" style={{ height: 80, marginBottom: 16 }} />
      ) : regime ? (
        <RegimeIndicator regime={regime} />
      ) : null}

      {/* Stats Row */}
      {stats && (
        <div className="grid-4" style={{ marginTop: 16 }}>
          <div className="glass-card animate-in stat-card">
            <span className="label">Districts Monitored</span>
            <span className="value">{stats.districts}</span>
          </div>
          <div className="glass-card animate-in stat-card">
            <span className="label">Avg Raw Precip</span>
            <span className="value">{stats.avgRaw} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>mm</span></span>
          </div>
          <div className="glass-card animate-in stat-card">
            <span className="label">Avg Corrected</span>
            <span className="value" style={{ color: 'var(--accent-primary)' }}>{stats.avgCorrected} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>mm</span></span>
          </div>
          <div className="glass-card animate-in stat-card">
            <span className="label">Heavy Rain Alerts</span>
            <span className="value" style={{ color: stats.heavyCount > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
              {stats.heavyCount}
            </span>
          </div>
        </div>
      )}

      {/* Lead Time Selector */}
      <div className="lead-selector" style={{ marginTop: 16 }}>
        {LEAD_TIMES.map((lt) => (
          <button
            key={lt}
            className={`lead-btn ${leadTime === lt ? 'active' : ''}`}
            onClick={() => setLeadTime(lt)}
          >
            T+{lt}h
          </button>
        ))}
      </div>

      {/* Main Grid: Table + Map */}
      {forecastLoading ? (
        <div className="skeleton" style={{ height: 400 }} />
      ) : forecasts ? (
        <div className="dashboard-grid" style={{ marginTop: 8 }}>
          <div className="table-panel">
            <DistrictTable forecasts={forecasts} />
          </div>
          <div className="map-panel">
            <DistrictMap forecasts={forecasts} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
