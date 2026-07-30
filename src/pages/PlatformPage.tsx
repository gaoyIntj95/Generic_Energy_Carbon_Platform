import { useLocation } from 'react-router-dom';
import { AssetOperationsV2 } from './newPrototype/AssetOperationsV2';
import { CarbonAccountingV4 } from './newPrototype/CarbonAccountingV4';
import { DataCollectionPage } from './newPrototype/DataCollectionPage';
import { DataManagementV11 } from './newPrototype/DataManagementV11';
import { EnergyAnalysisV4 } from './newPrototype/EnergyAnalysisV4';

/**
 * Route-level module dispatcher.
 *
 * Business state and interactions live in the corresponding module page and
 * its shared mock store. Keeping this component intentionally small prevents
 * legacy page demos from becoming a second, disconnected source of data.
 */
export function PlatformPage() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/data-management/')) {
    return <DataManagementV11 key={pathname} pathname={pathname} />;
  }
  if (pathname.startsWith('/energy-analysis/')) {
    return <EnergyAnalysisV4 pathname={pathname} />;
  }
  if (pathname.startsWith('/carbon-accounting/')) {
    return <CarbonAccountingV4 pathname={pathname} />;
  }
  if (pathname.startsWith('/asset-strategy/')) {
    return <AssetOperationsV2 pathname={pathname} />;
  }
  return <DataCollectionPage />;
}
