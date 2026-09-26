'use client';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

interface Props { label: string; value: number; suffix?: string; color?: string; delay?: number; }

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => v < 10 ? v.toFixed(1) : Math.round(v).toString());

  useEffect(() => {
    const ctrl = animate(count, value, { duration: 1.2, delay, ease: [0.34, 1.56, 0.64, 1] });
    return ctrl.stop;
  }, [value, delay, count]);

  return <motion.span>{rounded}</motion.span>;
}

export default function StatCard({ label, value, suffix = '', color, delay = 0 }: Props) {
  return (
    <motion.div
      className="glass"
      style={{ padding: '20px 24px' }}
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: delay * 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { background: `linear-gradient(135deg, ${color}, var(--text-1))`, WebkitBackgroundClip: 'text' } : {}}>
        <AnimatedNumber value={value} delay={delay * 0.1} />
        {suffix && <span style={{ fontSize: '0.85rem', fontWeight: 500, WebkitTextFillColor: 'var(--text-2)' }}> {suffix}</span>}
      </div>
    </motion.div>
  );
}
