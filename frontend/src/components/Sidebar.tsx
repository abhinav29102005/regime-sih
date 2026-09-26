'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const NAV = [
  { href: '/', icon: '📊', label: 'Dashboard' },
  { href: '/verification', icon: '✅', label: 'Verification' },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <motion.aside
      initial={{ x: -240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed', left: 0, top: 0, width: 240, height: '100vh',
        background: 'var(--bg-secondary)', borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column', padding: '24px 16px', zIndex: 100,
      }}
    >
      <div style={{ marginBottom: 32, paddingLeft: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.6rem' }}>🌧️</span>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
              REGIME-SIH
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Monsoon AI
            </div>
          </div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map((item) => {
          const isActive = path === item.href;
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
              <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  style={{
                    position: 'absolute', left: 0, width: 3, height: 24,
                    borderRadius: '0 3px 3px 0', background: 'var(--accent)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: 'auto', padding: '16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <div className="glow-dot" style={{ background: 'var(--green)', color: 'var(--green)' }} />
          <span>API Connected</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 6 }}>
          v0.1.0 • Mock Data
        </div>
      </div>
    </motion.aside>
  );
}
