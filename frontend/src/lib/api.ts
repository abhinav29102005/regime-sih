import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
});

export interface RegimeOutput {
  date: string;
  regime: 'active' | 'break' | 'depression' | 'western_disturbance' | 'normal';
  probabilities: Record<string, number>;
}

export interface DistrictForecast {
  district_id: string;
  district_name: string;
  state: string;
  lat: number;
  lon: number;
  date: string;
  lead_hours: number;
  raw_precip_mm: number;
  corrected_precip_mm: number;
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  regime: string;
  regime_confidence: number;
  heavy_rain_prob_65mm: number | null;
  heavy_rain_prob_115mm: number | null;
  category: string;
}

export interface VerificationSummary {
  regime: string;
  period_start: string;
  period_end: string;
  rmse_raw: number;
  rmse_corrected: number;
  mae_raw: number;
  mae_corrected: number;
  ets_by_threshold: Record<string, Record<string, number>>;
}

export const fetchCurrentRegime = () => api.get<RegimeOutput>('/regime/current').then(r => r.data);
export const fetchRegimeHistory = (start: string, end: string) => api.get<RegimeOutput[]>('/regime/history', { params: { start, end } }).then(r => r.data);
export const fetchDistrictForecast = (lead: number = 24) => api.get<DistrictForecast[]>('/forecast/district', { params: { lead } }).then(r => r.data.map(d => ({
  ...d,
  heavy_rain_prob_65mm: d.heavy_rain_prob_65mm != null ? d.heavy_rain_prob_65mm / 100 : null,
  heavy_rain_prob_115mm: d.heavy_rain_prob_115mm != null ? d.heavy_rain_prob_115mm / 100 : null
})));
export const fetchVerificationSummary = (regime: string) => api.get<VerificationSummary>('/verification/summary', { params: { regime } }).then(r => r.data);

export const REGIME_LABELS: Record<string, string> = {
  active: 'Active Monsoon', break: 'Break Monsoon',
  depression: 'Depression', western_disturbance: 'Western Disturbance', normal: 'Normal',
};

export const REGIME_COLORS: Record<string, string> = {
  active: '#4fc3f7', break: '#ff9800', depression: '#f44336',
  western_disturbance: '#5c6bc0', normal: '#4caf50',
};

export default api;
