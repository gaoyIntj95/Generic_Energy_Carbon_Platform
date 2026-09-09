import { useLocation, useNavigate } from 'react-router-dom';
import { DEFAULT_DATA_YEAR } from '../../mocks/annualData';

export function useDataYear() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const requested = Number(params.get('year'));
  const year = Number.isInteger(requested) && requested >= 1900 && requested <= 9999
    ? requested : DEFAULT_DATA_YEAR;
  const changeYear = (next: string, period?: { month: string; grain: string }) => {
    const query = new URLSearchParams();
    if (params.has('tab')) query.set('tab', params.get('tab')!);
    query.set('year', next);
    if (period) { query.set('month', period.month); query.set('grain', period.grain); }
    navigate({ pathname: location.pathname, search: `?${query}` });
  };
  return [String(year), changeYear] as const;
}
