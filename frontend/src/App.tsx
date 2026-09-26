import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import Verification from './pages/Verification';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

type Page = 'dashboard' | 'verification';

function App() {
  const [page, setPage] = useState<Page>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <nav className="sidebar">
        <div className="sidebar-logo">🌧️</div>
        <button
          className={`sidebar-item ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => setPage('dashboard')}
          title="Dashboard"
        >
          📊
        </button>
        <button
          className={`sidebar-item ${page === 'verification' ? 'active' : ''}`}
          onClick={() => setPage('verification')}
          title="Verification"
        >
          ✅
        </button>
      </nav>
      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'verification' && <Verification />}
      </main>
    </QueryClientProvider>
  );
}

export default App;
