import { useQuery } from '@tanstack/react-query';
import {
  fetchCurrentRegime,
  fetchDistrictForecast,
  fetchVerificationSummary,
  fetchRegimeHistory,
} from '../api/client';

export const useCurrentRegime = () =>
  useQuery({
    queryKey: ['regime', 'current'],
    queryFn: () => fetchCurrentRegime().then((r) => r.data),
    refetchInterval: 60_000,
  });

export const useDistrictForecast = (lead: number = 24) =>
  useQuery({
    queryKey: ['forecast', 'district', lead],
    queryFn: () => fetchDistrictForecast(lead).then((r) => r.data),
  });

export const useVerificationSummary = (regime: string) =>
  useQuery({
    queryKey: ['verification', regime],
    queryFn: () => fetchVerificationSummary(regime).then((r) => r.data),
  });

export const useRegimeHistory = (start: string, end: string) =>
  useQuery({
    queryKey: ['regime', 'history', start, end],
    queryFn: () => fetchRegimeHistory(start, end).then((r) => r.data),
  });
