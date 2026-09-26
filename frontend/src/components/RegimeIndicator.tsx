'use client';
import { motion } from 'framer-motion';
import { RegimeOutput, REGIME_LABELS, REGIME_COLORS } from '@/lib/api';

export default function RegimeIndicator({ regime }: { regime: RegimeOutput }) {
  const conf = (regime.probabilities[regime.regime] * 100).toFixed(0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      className="glass"
      style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}
    >
      <div>
        <div className="stat-label" style={{ marginBottom: 8 }}>Current Regime</div>
        <motion.span
          className={`regime-badge rb-${regime.regime}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
        >
          {REGIME_LABELS[regime.regime] || regime.regime}
        </motion.span>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginTop: 8 }}>
          <span style={{ fontWeight: 700, color: REGIME_COLORS[regime.regime] }}>{conf}%</span> confidence
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        <div className="stat-label" style={{ marginBottom: 10 }}>Probability Breakdown</div>
        <div className="prob-bar">
          {Object.entries(regime.probabilities).map(([name, prob]) => (
            <motion.div
              key={name}
              className="prob-seg"
              initial={{ width: 0 }}
              animate={{ width: `${prob * 100}%` }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ background: REGIME_COLORS[name] || '#666', minWidth: prob > 0.02 ? 4 : 0 }}
              title={`${name}: ${(prob * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(regime.probabilities).map(([name, prob]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: REGIME_COLORS[name] }} />
              <span style={{ color: 'var(--text-2)' }}>{name.replace(/_/g, ' ')}</span>
              <span style={{ fontWeight: 600 }}>{(prob * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
