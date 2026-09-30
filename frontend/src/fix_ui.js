const fs = require('fs');

// 1. Update Navbar
let nav = fs.readFileSync('components/Navbar.tsx', 'utf8');
nav = nav.replace(
  `          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              MeghDrishti
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Vision into every cloud's regime.
            </div>
          </div>`,
  `          <Link href="/" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                MeghDrishti
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Vision into every cloud's regime.
              </div>
            </motion.div>
          </Link>`
);

nav = nav.replace(
  `        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className='glow-dot' style={{ background: 'var(--green)', color: 'var(--green)' }} />
            <span>API Online</span>
          </div>
        </div>`,
  ``
);
fs.writeFileSync('components/Navbar.tsx', nav);

// 2. Update Districts Page
let page = fs.readFileSync('app/districts/page.tsx', 'utf8');
page = page.replace(
  `<div style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>`,
  `<div style={{ width: '100%', paddingBottom: 60 }}>`
);
fs.writeFileSync('app/districts/page.tsx', page);

// 3. Update District Table
let table = fs.readFileSync('components/DistrictTable.tsx', 'utf8');
table = table.replace(
  `style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}`,
  `style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: '100%' }}`
);
table = table.replace(
  `<div style={{ overflow: 'auto', flex: 1, paddingRight: 4 }}>`,
  `<div style={{ paddingRight: 4 }}>`
);
table = table.replace(
  `                    exit={{ opacity: 0 }}`,
  `                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.015, backgroundColor: 'rgba(0,100,255,0.03)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}`
);
fs.writeFileSync('components/DistrictTable.tsx', table);

console.log("UI updated!");
