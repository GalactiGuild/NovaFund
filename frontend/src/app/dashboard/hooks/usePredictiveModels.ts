import { useQuery } from '@tanstack/react-query';
import api from '../lib/api/client';

export function usePredictiveModels() {
  return useQuery({
    queryKey: ['predictiveInsights'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/predictive');
      return res.data;
    },
  });
}
