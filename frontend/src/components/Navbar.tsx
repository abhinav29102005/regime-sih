'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/verification', label: 'Verification' },
  { href: '/districts', label: 'Districts' },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(4, 8, 15, 0.7)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--glass-border)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 32px', height: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.6rem' }}>🌧️</span>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              REGIME-SIH
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Monsoon AI
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.03)', padding: 6, borderRadius: 100, border: '1px solid rgba(255,255,255,0.05)' }}>
          {NAV.map((item) => {
            const isActive = path === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ position: 'relative', padding: '8px 20px', fontSize: '0.88rem', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--bg-primary)' : 'var(--text-2)', textDecoration: 'none', transition: 'color 0.2s', zIndex: 1 }}>
                {isActive && (
                  <motion.div
                    layoutId='nav-pill'
                    style={{ position: 'absolute', inset: 0, background: 'var(--accent)', borderRadius: 100, zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className='glow-dot' style={{ background: 'var(--green)', color: 'var(--green)' }} />
            <span>API Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}
