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
      background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--glass-border)',
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 32px', height: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          
          <Link href="/" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                MeghDrishti
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Vision into every cloud's regime.
              </div>
            </motion.div>
          </Link>
        </div>

        <nav style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.03)', padding: 6, borderRadius: 6, border: '1px solid rgba(0,0,0,0.05)' }}>
          {NAV.map((item) => {
            const isActive = path === item.href;
            return (
              <Link key={item.href} href={item.href} style={{ position: 'relative', padding: '8px 20px', fontSize: '0.88rem', fontWeight: isActive ? 600 : 500, color: isActive ? '#ffffff' : 'var(--text-2)', textDecoration: 'none', transition: 'color 0.2s', zIndex: 1 }}>
                {isActive && (
                  <motion.div
                    layoutId='nav-pill'
                    style={{ position: 'absolute', inset: 0, background: 'var(--accent)', borderRadius: 6, zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>


      </div>
    </header>
  );
}
