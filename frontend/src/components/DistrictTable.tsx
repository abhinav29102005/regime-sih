import { useState, useMemo } from 'react';
import { DistrictForecast } from '../api/client';

interface Props {
  forecasts: DistrictForecast[];
}

type SortKey = 'district_name' | 'state' | 'raw_precip_mm' | 'corrected_precip_mm' | 'heavy_rain_prob_65mm' | 'category';

export default function DistrictTable({ forecasts }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('corrected_precip_mm');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let data = forecasts;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (f) =>
          f.district_name.toLowerCase().includes(q) ||
          f.state.toLowerCase().includes(q)
      );
    }
    data = [...data].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return data;
  }, [forecasts, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  const correctionPct = (f: DistrictForecast) => {
    if (f.raw_precip_mm === 0) return '—';
    const pct = ((f.corrected_precip_mm - f.raw_precip_mm) / f.raw_precip_mm * 100);
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(0)}%`;
  };

  return (
    <div className="glass-card animate-in" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>District Forecasts</h3>
        <input
          className="search-input"
          placeholder="Search district or state..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('district_name')}>District{arrow('district_name')}</th>
              <th onClick={() => handleSort('state')}>State{arrow('state')}</th>
              <th onClick={() => handleSort('raw_precip_mm')}>Raw (mm){arrow('raw_precip_mm')}</th>
              <th onClick={() => handleSort('corrected_precip_mm')}>Corrected (mm){arrow('corrected_precip_mm')}</th>
              <th>Δ%</th>
              <th onClick={() => handleSort('heavy_rain_prob_65mm')}>Heavy Rain %{arrow('heavy_rain_prob_65mm')}</th>
              <th onClick={() => handleSort('category')}>Category{arrow('category')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.district_id}>
                <td style={{ fontWeight: 500 }}>{f.district_name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{f.state}</td>
                <td>{f.raw_precip_mm.toFixed(1)}</td>
                <td style={{ fontWeight: 600 }}>{f.corrected_precip_mm.toFixed(1)}</td>
                <td>
                  <span style={{ color: f.corrected_precip_mm < f.raw_precip_mm ? 'var(--accent-green)' : 'var(--accent-orange)', fontSize: '0.8rem', fontWeight: 500 }}>
                    {correctionPct(f)}
                  </span>
                </td>
                <td>
                  {f.heavy_rain_prob_65mm != null
                    ? <span style={{ color: f.heavy_rain_prob_65mm > 0.5 ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: f.heavy_rain_prob_65mm > 0.5 ? 600 : 400 }}>
                        {(f.heavy_rain_prob_65mm * 100).toFixed(0)}%
                      </span>
                    : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </td>
                <td><span className={`category-pill ${f.category}`}>{f.category.replace('_', ' ')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
