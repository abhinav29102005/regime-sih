'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDistrictForecast } from '@/lib/api';
import DistrictTable from '@/components/DistrictTable';
import LeadSwitcher from '@/components/LeadSwitcher';

export default function Districts() {
  const [lead, setLead] = useState(24);
  const { data: forecasts, isLoading } = useQuery({ queryKey: ['forecast', 'district', lead], queryFn: () => fetchDistrictForecast(lead) });

  return (
    <div className='page-enter'>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.5px' }}>District-wise Forecasts</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginTop: 4 }}>Detailed tabular view of all monitored districts.</p>
        </div>
        <LeadSwitcher lead={lead} setLead={setLead} />
      </div>
      {isLoading ? <div className='skel' style={{ height: 600 }} /> : forecasts && (
        <div style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>
          <DistrictTable forecasts={forecasts} />
        </div>
      )}
    </div>
  );
}
