'use client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DistrictForecast } from '@/lib/api';

type SortKey = 'district_name' | 'state' | 'raw_precip_mm' | 'corrected_precip_mm' | 'heavy_rain_prob_65mm' | 'category' | 'temperature' | 'humidity' | 'wind_speed';

export default function DistrictTable({ forecasts }: { forecasts: DistrictForecast[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('corrected_precip_mm');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    let data = forecasts;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(f => f.district_name.toLowerCase().includes(q) || f.state.toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [forecasts, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <motion.div
      className="glass"
      style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: '100%' }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>District Forecasts</h3>
        <input
          placeholder="Search district..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)',
            borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', color: 'var(--text-1)', outline: 'none'
          }}
        />
      </div>

      <div style={{ paddingRight: 4 }}>
        <table className="data-tbl" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('district_name')}>District {sortKey === 'district_name' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('state')}>State {sortKey === 'state' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('raw_precip_mm')}>Raw {sortKey === 'raw_precip_mm' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('corrected_precip_mm')}>Corrected {sortKey === 'corrected_precip_mm' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th>Δ%</th>
              <th onClick={() => handleSort('temperature')}>Temp {sortKey === 'temperature' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('humidity')}>RH% {sortKey === 'humidity' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('wind_speed')}>Wind {sortKey === 'wind_speed' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('heavy_rain_prob_65mm')}>Heavy % {sortKey === 'heavy_rain_prob_65mm' ? (sortAsc ? '↑' : '↓') : ''}</th>
              <th onClick={() => handleSort('category')}>Category {sortKey === 'category' ? (sortAsc ? '↑' : '↓') : ''}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map(f => {
                const diff = f.raw_precip_mm > 0 ? ((f.corrected_precip_mm - f.raw_precip_mm) / f.raw_precip_mm * 100) : 0;
                return (
                  <motion.tr
                    key={f.district_id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.015, backgroundColor: 'rgba(0,100,255,0.03)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <td style={{ fontWeight: 500 }}>{f.district_name}</td>
                    <td style={{ color: 'var(--text-2)' }}>{f.state}</td>
                    <td>{f.raw_precip_mm.toFixed(1)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{f.corrected_precip_mm.toFixed(1)}</td>
<td>
                      <span className={f.corrected_precip_mm < f.raw_precip_mm ? 'improve' : 'degrade'}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                      </span>
                    </td>
                    <td>{f.temperature != null ? f.temperature.toFixed(1) + '°' : '-'}</td>
                    <td>{f.humidity != null ? f.humidity.toFixed(0) + '%' : '-'}</td>
                    <td>{f.wind_speed != null ? f.wind_speed.toFixed(1) : '-'}</td>
                    <td>
                      {f.heavy_rain_prob_65mm != null
                        ? <span style={{ color: f.heavy_rain_prob_65mm > 0.5 ? 'var(--red)' : 'var(--text-2)', fontWeight: f.heavy_rain_prob_65mm > 0.5 ? 700 : 600 }}>
                            {(f.heavy_rain_prob_65mm * 100).toFixed(0)}%
                          </span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td><span className={`cat-pill cat-${f.category.toLowerCase().replace(' rain', '').replace(' ', '_')}`}>{f.category.replace(/_/g, ' ')}</span></td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
