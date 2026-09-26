import { useMemo } from 'react';
import { DistrictForecast } from '../api/client';

interface Props {
  forecasts: DistrictForecast[];
}

const RAIN_COLORS = [
  { max: 2, color: '#1a237e' },
  { max: 10, color: '#1565c0' },
  { max: 25, color: '#42a5f5' },
  { max: 50, color: '#66bb6a' },
  { max: 75, color: '#fdd835' },
  { max: 100, color: '#ffa726' },
  { max: 150, color: '#ff7043' },
  { max: 999, color: '#ef5350' },
];

function getRainColor(mm: number): string {
  for (const { max, color } of RAIN_COLORS) {
    if (mm <= max) return color;
  }
  return '#ef5350';
}

export default function DistrictMap({ forecasts }: Props) {
  const maxPrecip = useMemo(
    () => Math.max(...forecasts.map((f) => f.corrected_precip_mm), 1),
    [forecasts]
  );

  return (
    <div className="glass-card animate-in" style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
        Rainfall Map — India
      </h3>

      {/* SVG-based simple India map with district dots */}
      <div style={{ flex: 1, position: 'relative', background: 'rgba(6, 11, 24, 0.6)', borderRadius: 'var(--radius-md)', overflow: 'hidden', minHeight: '350px' }}>
        <svg viewBox="63 5 38 36" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          {/* India outline approximation */}
          <path
            d="M68,8 L78,8 L80,10 L82,9 L85,10 L88,12 L92,14 L95,16 L97,18 L97,22 L95,25 L92,28 L88,30 L85,32 L82,34 L80,36 L78,38 L76,36 L74,34 L72,30 L70,26 L68,22 L66,18 L66,14 L67,10 Z"
            fill="rgba(79, 195, 247, 0.04)"
            stroke="rgba(79, 195, 247, 0.15)"
            strokeWidth="0.15"
          />

          {/* District dots */}
          {forecasts.map((f) => (
            <g key={f.district_id}>
              <circle
                cx={f.lon}
                cy={40 - f.lat}
                r={0.5 + (f.corrected_precip_mm / maxPrecip) * 0.8}
                fill={getRainColor(f.corrected_precip_mm)}
                opacity={0.85}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.08"
              >
                <title>{`${f.district_name}: ${f.corrected_precip_mm.toFixed(1)} mm`}</title>
              </circle>
            </g>
          ))}
        </svg>

        {/* Color legend */}
        <div style={{
          position: 'absolute', bottom: '12px', right: '12px',
          background: 'rgba(6, 11, 24, 0.85)', borderRadius: '8px',
          padding: '8px 12px', fontSize: '0.65rem',
        }}>
          <div style={{ marginBottom: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>mm/day</div>
          {RAIN_COLORS.map(({ max, color }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {i === 0 ? `< ${max}` : i === RAIN_COLORS.length - 1 ? `${RAIN_COLORS[i-1].max}+` : `${RAIN_COLORS[i-1].max}–${max}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
