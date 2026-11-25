import DrawbackTab from './DrawbackTab';
import LicenseTab from './LicenseTab';
import RodtepTab from './RodtepTab';
import RosctlTab from './RosctlTab';
import Ar4Tab from './Ar4Tab';
import MoowrTab from './MoowrTab';
import { isDbkItem, isLicenceItem, isRodtepItem, isRosctlItem } from './schemeUtils';

// Sub-tabs of Scheme and when each one shows. Scheme 60 (Drawback + RoSCTL) shows Dbk and RoSCTL; RoDTEP also shows
// for items whose SW info has DTY / RDT (set on the Items tab).
export const SCHEME_CONFIG = [
  { key: 'dbk', label: 'Dbk', component: DrawbackTab, condition: (items) => (items || []).some(isDbkItem) },
  { key: 'rosctl', label: 'RoSCTL', component: RosctlTab, condition: (items) => (items || []).some(isRosctlItem) },
  { key: 'rodtep', label: 'RoDTEP', component: RodtepTab, condition: (items) => (items || []).some(isRodtepItem) },
  { key: 'license', label: 'License', component: LicenseTab, condition: (items) => (items || []).some(isLicenceItem) },
  { key: 'ar4', label: 'AR4', component: Ar4Tab, condition: (items) => (items || []).some((item) => String(item.ar4 || '').toUpperCase() === 'Y') },
  { key: 'moowr', label: 'MOOWR Details', component: MoowrTab, condition: (items, exportData) => !!exportData && exportData.autoField_31 === 'Yes' },
];
