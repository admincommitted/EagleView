import { AlertTriangle, CreditCard, FileText, Package, Shield, User } from 'lucide-react';

// Saved as App Settings email_tpl_<id> (JSON of { enabled, subject, body, notifyMode, notifyTime }).
export const EMAIL_TYPES = [
  {
    id: 'password_reset',
    icon: Shield,
    iconClassName: 'tw:text-destructive',
    label: 'Password Reset',
    desc: 'Sent when a user requests a new password',
    defaultSubject: 'Your Password Has Been Reset — Committed Cargo ERP',
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>Your ERP account password has been reset.</p>
<table style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>User ID:</b></td><td>{userId}</td></tr>
  <tr><td><b>New Password:</b></td><td style="font-family:monospace;color:#dc2626;">{password}</td></tr>
</table>
<p>Please log in and change your password immediately.</p>
<p style="color:#64748b;font-size:12px;">This is an automated message. Do not reply.</p>`,
  },
  {
    id: 'kyc_notification',
    icon: User,
    iconClassName: 'tw:text-violet-600',
    label: 'KYC Notification',
    desc: 'Sent when KYC documents are submitted or require action',
    defaultSubject: 'KYC Update — {partyName} — Committed Cargo',
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>This is to inform you regarding the KYC status for <b>{partyName}</b>.</p>
<table style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>Party Name:</b></td><td>{partyName}</td></tr>
  <tr><td><b>KYC Status:</b></td><td style="color:#7c3aed;font-weight:bold;">{kycStatus}</td></tr>
  <tr><td><b>Remarks:</b></td><td>{remarks}</td></tr>
</table>
<p>Please take the necessary action at the earliest.</p>`,
  },
  {
    id: 'shipment_status',
    icon: Package,
    iconClassName: 'tw:text-primary',
    label: 'Shipment Status',
    desc: 'Sent to client when shipment status changes',
    defaultSubject: 'Shipment Status Update — AWB {awb} — Committed Cargo',
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>We would like to inform you of the latest status update for your consignment.</p>
<table style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>AWB Number:</b></td><td style="font-weight:bold;">{awb}</td></tr>
  <tr><td><b>Current Status:</b></td><td style="color:#2563eb;font-weight:bold;">{status}</td></tr>
  <tr><td><b>Updated On:</b></td><td>{date}</td></tr>
</table>
<p>For any queries, please contact us at <a href="mailto:info@committedcargo.com">info@committedcargo.com</a>.</p>
<p style="color:#64748b;font-size:12px;">This is an automated status notification.</p>`,
  },
  {
    id: 'invoice',
    icon: CreditCard,
    iconClassName: 'tw:text-success',
    label: 'Invoice / Billing',
    desc: 'Sent when an invoice is generated for a party',
    defaultSubject: 'Invoice #{invoiceNo} — Committed Cargo Care Ltd.',
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>Please find below the details of your invoice.</p>
<table style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>Invoice No:</b></td><td style="font-weight:bold;">#{invoiceNo}</td></tr>
  <tr><td><b>Date:</b></td><td>{date}</td></tr>
  <tr><td><b>Amount:</b></td><td style="color:#16a34a;font-weight:bold;">₹{amount}</td></tr>
  <tr><td><b>Due Date:</b></td><td>{dueDate}</td></tr>
</table>
<p>Please process the payment by the due date to avoid any inconvenience.</p>
<p>For queries, contact our accounts team.</p>`,
  },
  {
    id: 'account_alert',
    icon: AlertTriangle,
    iconClassName: 'tw:text-warning',
    label: 'Account Alert',
    desc: 'Sent for account lock, unlock, or activation events',
    defaultSubject: 'Account Alert — {alertType} — Committed Cargo ERP',
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>This is an automated security alert regarding your ERP account.</p>
<table style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>User ID:</b></td><td>{userId}</td></tr>
  <tr><td><b>Alert Type:</b></td><td style="color:#b45309;font-weight:bold;">{alertType}</td></tr>
  <tr><td><b>Date & Time:</b></td><td>{datetime}</td></tr>
</table>
<p>If this was not you, please contact your system administrator immediately.</p>`,
  },
  {
    id: 'customs_update',
    icon: FileText,
    iconClassName: 'tw:text-cyan-600',
    label: 'Customs / Clearance Update',
    desc: 'Sent when customs clearance status changes',
    defaultSubject: 'Customs Clearance Update — {jobNo} — Committed Cargo',
    defaultBody: `<p>Dear <b>{name}</b>,</p>
<p>There is an update on the customs clearance for your shipment.</p>
<table style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:16px;margin:16px 0;">
  <tr><td><b>Job No:</b></td><td style="font-weight:bold;">{jobNo}</td></tr>
  <tr><td><b>AWB / BL No:</b></td><td>{awb}</td></tr>
  <tr><td><b>Status:</b></td><td style="color:#0891b2;font-weight:bold;">{status}</td></tr>
  <tr><td><b>Remarks:</b></td><td>{remarks}</td></tr>
</table>
<p>Please take the necessary action if required.</p>
<p style="color:#64748b;font-size:12px;">Committed Cargo Care Ltd. | <a href="mailto:info@committedcargo.com">info@committedcargo.com</a></p>`,
  },
];

export const SUBJECT_VARIABLES = ['{name}', '{awb}', '{userId}', '{partyName}', '{invoiceNo}', '{jobNo}', '{alertType}'];

export const templateSettingKey = (typeId) => `email_tpl_${typeId}`;

export const defaultTypeConfigs = () => Object.fromEntries(EMAIL_TYPES.map((type) => [type.id, {
  enabled: true,
  subject: type.defaultSubject,
  body: type.defaultBody,
  notifyMode: 'instant',
  notifyTime: '09:00',
}]));

const SAMPLE_DATA = {
  name: 'Rahul Sharma', userId: 'ADMIN01', password: 'Xk9#mP2q',
  partyName: 'ABC Exports Pvt. Ltd.', kycStatus: 'Pending Verification', remarks: 'PAN card required',
  awb: '020-12345678', status: 'Shipment Arrived at Delhi Airport', date: new Date().toLocaleDateString('en-IN'),
  invoiceNo: 'INV-2024-0891', amount: '12,500.00', dueDate: '30 Sep 2026',
  alertType: 'Account Locked', datetime: new Date().toLocaleString('en-IN'),
  jobNo: 'IMP-2024-1203',
};

/** The template with its {variables} filled from the sample data (for the preview). */
export const fillWithSample = (template) =>
  Object.entries(SAMPLE_DATA).reduce((text, [key, value]) => text.replace(new RegExp(`{${key}}`, 'g'), value), template);

export const PREVIEW_HEADER = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="background:#1e3a5f;padding:20px 24px;display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#25D366;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📧</div>
        <div>
          <div style="color:white;font-weight:700;font-size:16px;">Committed Cargo Care Ltd.</div>
          <div style="color:#94a3b8;font-size:12px;">info@committedcargo.com</div>
        </div>
      </div>
      <div style="padding:24px;">
        <div style="font-size:13px;color:#374151;line-height:1.7;">
  `;

export const PREVIEW_FOOTER = `
        </div>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 24px;text-align:center;font-size:11px;color:#94a3b8;">
        Committed Cargo Care Ltd. &nbsp;|&nbsp; This is an automated notification &nbsp;|&nbsp; Do not reply
      </div>
    </div>
  `;
