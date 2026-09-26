'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDistrictForecast } from '@/lib/api';
import DistrictTable from '@/components/DistrictTable';

export default function Districts() {
  const [lead, setLead] = useState(24);

  const { data: forecasts, isLoading } = useQuery({
    queryKey: ['forecast', 'district', lead],
    queryFn: () => fetchDistrictForecast(lead),
  });

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>District-wise Forecasts</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', marginTop: 4 }}>Detailed tabular view of all monitored districts.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[12, 24, 48, 72].map(l => (
            <button key={l} className={`lead-btn ${lead === l ? 'active' : ''}`} onClick={() => setLead(l)}>
              T+{l}h
            </button>
          ))}
        </div>
      </div>
      
      {isLoading ? <div className="skel" style={{ height: 'calc(100vh - 140px)' }} /> : forecasts && (
        <div style={{ height: 'calc(100vh - 140px)' }}>
          <DistrictTable forecasts={forecasts} />
        </div>
      )}
    </div>
  );
}
