import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CountryMasterForm from '../components/MDMForms/CountryMasterForm';
import PortMasterForm from '../components/MDMForms/PortMasterForm';
import CurrencyMasterForm from '../components/MDMForms/CurrencyMasterForm';
import DutyNotifMasterForm from '../components/MDMForms/DutyNotifMasterForm';
import TransporterMasterForm from '../components/MDMForms/TransporterMasterForm';
import VesselMasterForm from '../components/MDMForms/VesselMasterForm';
import WarehouseMasterForm from '../components/MDMForms/WarehouseMasterForm';
import ItemTemplateMasterForm from '../components/MDMForms/ItemTemplateMasterForm';
import PartyMasterForm from '../components/MDMForms/PartyMasterForm';
import AirwayBillChargesMaster from '../components/MDMForms/AirwayBillChargesMaster';
import RspMasterForm from '../components/MDMForms/RspMasterForm';
import DutyListsMasterForm from '../components/MDMForms/DutyListsMasterForm';
import UqcMasterForm from '../components/MDMForms/UqcMasterForm';
import BondMasterForm from '../components/MDMForms/BondMasterForm';
import ShippingLineMasterForm from '../components/MDMForms/ShippingLineMasterForm';
import IcaffePartyDirectoryForm from '../components/MDMForms/IcaffePartyDirectoryForm';
import AirlineMasterForm from '../components/MDMForms/AirlineMasterForm';
import LicenseMasterForm from '../components/MDMForms/LicenseMasterForm';
import DrawbackMasterForm from '../components/MDMForms/DrawbackMasterForm';
import RodtepMasterForm from '../components/MDMForms/RodtepMasterForm';
import RosctlMasterForm from '../components/MDMForms/RosctlMasterForm';
import ExportPolicyMasterForm from '../components/MDMForms/ExportPolicyMasterForm';
import SchemeCodeMasterForm from '../components/MDMForms/SchemeCodeMasterForm';
import HsnRitcMasterForm from '../components/MDMForms/HsnRitcMasterForm';
import AirwayBillStockForm from '../components/MDMForms/AirwayBillStockForm';
import IataAgentMasterForm from '../components/MDMForms/IataAgentMasterForm';
import SphMasterForm from '../components/MDMForms/SphMasterForm';
import ESanchitMasterForm from '../components/MDMForms/ESanchitMasterForm';
import StatusMasterForm from '../components/MDMForms/StatusMasterForm';
import UserManagementForm from '../components/MDMForms/UserManagementForm';
import TactMasterForm from '../components/MDMForms/TactMasterForm';
import PenaltyRulesMasterForm from '../components/MDMForms/PenaltyRulesMasterForm';
import IcegateCredentialsNotice from './MastersParts/IcegateCredentialsNotice';

const MASTER_FORMS = {
  'tact-compliance': TactMasterForm,
  'penalty-rules': PenaltyRulesMasterForm,
  party: PartyMasterForm,
  users: UserManagementForm,
  country: CountryMasterForm,
  port: PortMasterForm,
  currency: CurrencyMasterForm,
  uqc: UqcMasterForm,
  'hsn-ritc': HsnRitcMasterForm,
  bond: BondMasterForm,
  license: LicenseMasterForm,
  rsp: RspMasterForm,
  'duty-lists': DutyListsMasterForm,
  duty: DutyNotifMasterForm,
  drawback: DrawbackMasterForm,
  rodtep: RodtepMasterForm,
  rosctl: RosctlMasterForm,
  'export-policy': ExportPolicyMasterForm,
  schemecodes: SchemeCodeMasterForm,
  transporter: TransporterMasterForm,
  vessel: VesselMasterForm,
  'shipping-line': ShippingLineMasterForm,
  'icaffe-parties': IcaffePartyDirectoryForm,
  airline: AirlineMasterForm,
  'airway-bill-stock': AirwayBillStockForm,
  awbcharges: AirwayBillChargesMaster,
  'sph-master': SphMasterForm,
  'status-master': StatusMasterForm,
  'iata-agent': IataAgentMasterForm,
  warehouse: WarehouseMasterForm,
  'item-template': ItemTemplateMasterForm,
  icegate: IcegateCredentialsNotice,
  esanchit: ESanchitMasterForm,
};

const HUB_SEGMENTS = ['master', 'mdm'];

const lastSegment = (pathname) => pathname.split('/').pop();

export default function MDM() {
  const { pathname } = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const segment = lastSegment(pathname) || 'party';
    return HUB_SEGMENTS.includes(segment) ? 'party' : segment;
  });

  useEffect(() => {
    const segment = lastSegment(pathname);
    if (segment && !HUB_SEGMENTS.includes(segment)) setActiveTab(segment);
  }, [pathname]);

  const ActiveForm = MASTER_FORMS[activeTab] || PartyMasterForm;

  return (
    <div className="tw:w-full tw:lg:h-[calc(100vh-120px)] tw:lg:overflow-hidden">
      <ActiveForm />
    </div>
  );
}
