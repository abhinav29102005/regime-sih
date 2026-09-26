import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
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

export const fetchCurrentRegime = () =>
  api.get<RegimeOutput>('/regime/current');

export const fetchRegimeHistory = (start: string, end: string) =>
  api.get<RegimeOutput[]>('/regime/history', { params: { start, end } });

export const fetchDistrictForecast = (lead: number = 24) =>
  api.get<DistrictForecast[]>('/forecast/district', { params: { lead } });

export const fetchVerificationSummary = (regime: string) =>
  api.get<VerificationSummary>('/verification/summary', { params: { regime } });

export default api;
