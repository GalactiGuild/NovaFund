import { useQuery } from '@tanstack/react-query';
import api from '../lib/api/';

export function useAnalyticsData() {
  return useQuery({
    queryKey: ['analyticsData'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/performance');
      return res.data;
    },
    refetchInterval: 5000, // real-time updates
  });
}
