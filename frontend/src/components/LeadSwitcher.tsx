'use client';
import { motion } from 'framer-motion';

export default function LeadSwitcher({ lead, setLead }: { lead: number, setLead: (v: number) => void }) {
  const options = [12, 24, 48, 72];
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: 5, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
      {options.map(l => {
        const active = lead === l;
        return (
          <button
            key={l}
            onClick={() => setLead(l)}
            style={{
              position: 'relative', padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600,
              color: active ? '#fff' : 'var(--text-3)', background: 'transparent', border: 'none',
              cursor: 'pointer', outline: 'none', transition: 'color 0.2s', zIndex: 1
            }}
          >
            {active && (
              <motion.div
                layoutId='lead-pill'
                style={{ position: 'absolute', inset: 0, background: 'rgba(79, 195, 247, 0.2)', border: '1px solid var(--accent)', borderRadius: 8, zIndex: -1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            )}
            T+{l}h
          </button>
        );
      })}
    </div>
  );
}
