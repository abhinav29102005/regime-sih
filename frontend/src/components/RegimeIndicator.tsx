import { RegimeOutput } from '../api/client';

const REGIME_LABELS: Record<string, string> = {
  active: '🌧️ Active Monsoon',
  break: '☀️ Break Monsoon',
  depression: '🌀 Depression',
  western_disturbance: '❄️ Western Disturbance',
  normal: '🌤️ Normal',
};

const REGIME_COLORS: Record<string, string> = {
  active: 'var(--regime-active)',
  break: 'var(--regime-break)',
  depression: 'var(--regime-depression)',
  western_disturbance: 'var(--regime-wd)',
  normal: 'var(--regime-normal)',
};

interface Props {
  regime: RegimeOutput;
}

export default function RegimeIndicator({ regime }: Props) {
  const confidence = (regime.probabilities[regime.regime] * 100).toFixed(0);

  return (
    <div className="glass-card animate-in" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Current Regime
        </div>
        <span className={`regime-badge ${regime.regime}`}>
          {REGIME_LABELS[regime.regime] || regime.regime}
        </span>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
          {confidence}% confidence
        </div>
      </div>

      <div style={{ flex: 1, minWidth: '250px' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Probability Breakdown
        </div>
        <div className="prob-bar-container">
          {Object.entries(regime.probabilities).map(([name, prob]) => (
            <div
              key={name}
              className="prob-bar-segment"
              style={{
                width: `${prob * 100}%`,
                background: REGIME_COLORS[name] || '#666',
                minWidth: prob > 0.02 ? '4px' : '0',
              }}
              title={`${name}: ${(prob * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
          {Object.entries(regime.probabilities).map(([name, prob]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: REGIME_COLORS[name] || '#666' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{name.replace('_', ' ')}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{(prob * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
