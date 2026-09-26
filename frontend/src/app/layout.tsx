import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/lib/providers';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'MeghDrishti | Vision into every cloud's regime',
  description: 'AI Post-Processing of Monsoon Rainfall',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <Providers>
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1, maxWidth: 1400, margin: '0 auto', width: '100%', padding: '32px' }}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
