import { useLocation } from 'react-router-dom';
import React from 'react';
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
import { Globe, MapPin, DollarSign, Scale, FileCode, ShieldCheck, Truck, Key, Ship, Building2, Copy, Users, Tag } from 'lucide-react';

export default function MDM() {
  const routeLocation = useLocation();
  const initialTab = routeLocation.pathname.split('/').pop() || 'party';
  const [activeTab, setActiveTab] = React.useState(initialTab === 'master' || initialTab === 'mdm' ? 'party' : initialTab);

  React.useEffect(() => {
    const tab = routeLocation.pathname.split('/').pop();
    if (tab && tab !== 'master' && tab !== 'mdm') {
      setActiveTab(tab);
    }
  }, [routeLocation.pathname]);

  const mdmCategories = [
    { id: 'party',            name: 'Unified Party Master',             icon: <Users size={16} /> },
    // 08-Nov-2026: iCAFFE Party Directory hidden from the list - all its parties are in the Party Master (page still opens by its link)
    { id: 'users',            name: 'User Management',                  icon: <Users size={16} /> },
    { id: 'country',          name: 'Country Master',                   icon: <Globe size={16} /> },
    { id: 'port',             name: 'Unified Port & CHA Master',        icon: <MapPin size={16} /> },
    { id: 'currency',         name: 'Currency & Exchange Rates',        icon: <DollarSign size={16} /> },
    { id: 'uqc',              name: 'UQC (Unit of Measurement)',        icon: <Scale size={16} /> },
    { id: 'hsn-ritc',         name: 'Unified HSN / Tariff Master',      icon: <FileCode size={16} /> },
    { id: 'bond',             name: 'BE Bond Code Master (Import)',     icon: <FileCode size={16} /> },
    { id: 'license',          name: 'Importer License Master (Import)', icon: <FileCode size={16} /> },
    { id: 'rsp',              name: 'RSP & Abatement Master (Import)',  icon: <FileCode size={16} /> },
    { id: 'duty-lists',       name: 'Customs Duty Lists (ADD / CVD / Cess / Tariff Value)', icon: <FileCode size={16} /> },
    { id: 'duty',             name: 'Exemption Notifications (Import)', icon: <ShieldCheck size={16} /> },
    { id: 'drawback',         name: 'Drawback Schedule (Export)',       icon: <FileCode size={16} /> },
    { id: 'rodtep',           name: 'RoDTEP Schedule (Export)',         icon: <FileCode size={16} /> },
    { id: 'rosctl',           name: 'RoSCTL Schedule (Export)',         icon: <FileCode size={16} /> },
    { id: 'export-policy',    name: 'Export Tariff & Policy',           icon: <ShieldCheck size={16} /> },
    { id: 'transporter',      name: 'Transporter Master',               icon: <Truck size={16} /> },
    { id: 'vessel',           name: 'Vessel / Flight Master',           icon: <Ship size={16} /> },
    { id: 'shipping-line',    name: 'Shipping Line Master (Sea)',       icon: <Ship size={16} /> },
    { id: 'airline',          name: 'Airline Master',                   icon: <Globe size={16} /> },
    { id: 'airway-bill-stock',name: 'AirWayBill Stock',                 icon: <FileCode size={16} /> },
    { id: 'awbcharges',       name: 'Airway Bill Charges Master',       icon: <FileCode size={16} /> },
    { id: 'sph-master',       name: 'SPH Codes Master',                 icon: <Tag size={16} /> },
    { id: 'status-master',    name: 'Status Master',                    icon: <FileCode size={16} /> },
    { id: 'iata-agent',       name: 'IATA Agent Master',                icon: <Users size={16} /> },
    { id: 'warehouse',        name: 'Warehouse Master',                 icon: <Building2 size={16} /> },
    { id: 'item-template',    name: 'JSON Item Templates',              icon: <Copy size={16} /> },
    { id: 'icegate',          name: 'ICEGATE Credentials',             icon: <Key size={16} /> },
    { id: 'esanchit',         name: 'e-Sanchit Document Codes',        icon: <FileCode size={16} /> },
    { id: 'tact-compliance',  name: 'IATA TACT & Compliance',          icon: <ShieldCheck size={16} /> },
    { id: 'penalty-rules',    name: 'Penalty & Demurrage Rules',       icon: <DollarSign size={16} /> },
  ];

  const renderActiveForm = () => {
    switch (activeTab) {
      case 'tact-compliance': return <TactMasterForm />;
        case 'penalty-rules': return <PenaltyRulesMasterForm />;
        case 'party':             return <PartyMasterForm />;
      case 'users':             return <UserManagementForm />;
      case 'country':           return <CountryMasterForm />;
      case 'port':              return <PortMasterForm />;
      case 'currency':          return <CurrencyMasterForm />;
      case 'uqc':               return <UqcMasterForm />;
      case 'hsn-ritc':          return <HsnRitcMasterForm />;
      case 'bond':              return <BondMasterForm />;
      case 'license':           return <LicenseMasterForm />;
      case 'rsp':               return <RspMasterForm />;
      case 'duty-lists':        return <DutyListsMasterForm />;
      case 'duty':              return <DutyNotifMasterForm />;
      case 'drawback':          return <DrawbackMasterForm />;
      case 'rodtep':            return <RodtepMasterForm />;
      case 'rosctl':            return <RosctlMasterForm />;
      case 'export-policy':     return <ExportPolicyMasterForm />;
      case 'schemecodes':       return <SchemeCodeMasterForm />;
      case 'transporter':       return <TransporterMasterForm />;
      case 'vessel':            return <VesselMasterForm />;
      case 'shipping-line':     return <ShippingLineMasterForm />;
      case 'icaffe-parties':    return <IcaffePartyDirectoryForm />;
      case 'airline':           return <AirlineMasterForm />;
      case 'airway-bill-stock': return <AirwayBillStockForm />;
      case 'awbcharges':        return <AirwayBillChargesMaster />;
      case 'sph-master':        return <SphMasterForm />;
      case 'status-master':     return <StatusMasterForm />;
      case 'iata-agent':        return <IataAgentMasterForm />;
      case 'warehouse':         return <WarehouseMasterForm />;
      case 'item-template':     return <ItemTemplateMasterForm />;
      // 28-Oct-2026: the old ICEGATE Credentials screen (table SystemConfiguration) was not used by any filing code
      // and sent the ICEGATE password / API key to the browser. ICEGATE logins are kept in Settings > ICEGATE Profiles.
      case 'icegate':           return (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '640px' }}>
          <h3 style={{ marginTop: 0 }}>ICEGATE Credentials</h3>
          <p style={{ color: 'var(--text-muted, #475569)', fontSize: '14px', lineHeight: 1.6 }}>ICEGATE login ID, password and API key are now kept in <b>Settings &gt; ICEGATE Profiles</b> (one profile per CHA / login, with a default). Filing, the ICEGATE test and e-mail reading all use those profiles.</p>
          <a href="/settings?tab=icegate" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '8px', textDecoration: 'none' }}>Open ICEGATE Profiles</a>
        </div>
      );
      case 'esanchit':          return <ESanchitMasterForm />;
      default:                  return <PartyMasterForm />;
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', width: '100%', overflow: 'hidden' }}>{/* was 100vw: with the page margin every master was cut 24px on the right */}
      {renderActiveForm()}
    </div>
  );
}

