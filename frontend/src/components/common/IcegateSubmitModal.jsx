import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle, Download, Loader, Shield } from 'lucide-react';
import { Button, Checkbox, Field, Input, Label, Modal, SelectBox } from '@/components/ui';
import { defaultIcegateId, rememberIcegateId } from './IcegateIdPickModal';
import { sharedWidgetsApi } from './sharedWidgetsApi';

const FORM_ID = 'icegate-submit-form';

const AMENDMENT_TYPES = [
  { value: 'P', label: 'Prior to Out of Charge (P)' },
  { value: 'A', label: 'After Out of Charge (A)' },
  { value: 'S', label: 'SCMTR Manifest Amendment (S)' },
];

const profileOption = (profile, chaCode) => ({
  value: String(profile.id),
  label: `${profile.profileName} — ${profile.loginId} ${profile.linkedChaCode === chaCode && chaCode ? '(Matched CHA)' : ''}`,
});

function AmendmentFields({ amendmentType, onTypeChange, amendReason, onReasonChange, disabled }) {
  return (
    <div className="tw:grid tw:gap-2.5 tw:rounded-md tw:border tw:border-dashed tw:border-input tw:bg-page tw:p-3">
      <Field label="Amendment Type" layout="col">
        <SelectBox options={AMENDMENT_TYPES} value={amendmentType} onValueChange={onTypeChange} disabled={disabled} className="tw:w-full" />
      </Field>
      <Field label="Amendment Reason" layout="col" required>
        <Input value={amendReason} onChange={(event) => onReasonChange(event.target.value)} disabled={disabled} required placeholder="Enter reason for amendment" data-allow-text="" />
      </Field>
    </div>
  );
}

// allowAmendment={false}: a BE amendment cannot go as JSON (ICEGATE takes it only as the CACHI01_A flat file from
// ACTIONS > BE Amendment File); the Shipping Bill still files amendments here.
// onSignOnly(profileId, pin): optional - signs the file with the token and downloads it, nothing goes to ICEGATE.
export default function IcegateSubmitModal({ chaCode, onSubmit, onClose, loading, allowAmendment = true, onSignOnly }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tokenPin, setTokenPin] = useState('');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [isAmendment, setIsAmendment] = useState(false);
  const [amendmentType, setAmendmentType] = useState('P');
  const [amendReason, setAmendReason] = useState('');

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const answer = await sharedWidgetsApi.icegateProfiles();
        if (answer.success) {
          const list = answer.data || [];
          setProfiles(list);
          if (list.length > 0) setSelectedId(defaultIcegateId(list, chaCode));
          else setError('No ICEGATE profiles found. Please add one in Settings.');
        }
      } catch {
        setError('Failed to fetch ICEGATE profiles');
      } finally {
        setFetching(false);
      }
    };
    loadProfiles();
  }, [chaCode]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedId) return;
    if (isAmendment && !amendReason) {
      toast.error('Enter the reason for the amendment');
      return;
    }
    rememberIcegateId(selectedId);
    onSubmit(selectedId, tokenPin, isAmendment, amendmentType, amendReason);
  };

  const signOnly = async () => {
    rememberIcegateId(selectedId);
    setSigning(true);
    try {
      await onSignOnly(selectedId, tokenPin);
    } finally {
      setSigning(false);
    }
  };

  const showForm = !fetching && !error;
  const footer = showForm && (
    <>
      {onSignOnly && (
        <Button
          variant="success"
          className="tw:mr-auto"
          title="Signs the file with the token and downloads it - nothing is sent to ICEGATE. Check it on filesign.icegate.gov.in (Verify)."
          disabled={!selectedId || !tokenPin || loading || signing}
          onClick={signOnly}
        >
          {signing ? <Loader className="tw:animate-spin" /> : <Download />}
          Download signed file (not sent)
        </Button>
      )}
      <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
      <Button type="submit" form={FORM_ID} variant="default" className="tw:border-success tw:bg-success tw:hover:bg-success/85" disabled={!selectedId || !tokenPin || loading}>
        {loading ? <Loader className="tw:animate-spin" /> : <CheckCircle />}
        Confirm Submit
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={() => { if (!loading) onClose(); }}
      title={<span className="tw:flex tw:items-center tw:gap-2"><Shield className="tw:size-5 tw:text-success" /> Submit to ICEGATE</span>}
      width={480}
      closeOnOutside={false}
      footer={footer}
    >
      {fetching && <p className="tw:m-0 tw:p-5 tw:text-center tw:text-muted-foreground">Loading profiles...</p>}
      {!fetching && error && <p className="tw:m-0 tw:rounded-md tw:bg-destructive/10 tw:p-3 tw:text-[13px] tw:text-destructive">{error}</p>}
      {showForm && (
        <form id={FORM_ID} onSubmit={handleSubmit} className="tw:grid tw:gap-4">
          <Field label="Select ICEGATE ID (Digital Signature Profile)" layout="col">
            <SelectBox
              options={profiles.map((profile) => profileOption(profile, chaCode))}
              value={selectedId}
              onValueChange={setSelectedId}
              disabled={loading}
              className="tw:w-full"
            />
          </Field>

          {allowAmendment ? (
            <div className="tw:flex tw:items-center tw:gap-2">
              <Checkbox id="icegate-amendment" checked={isAmendment} onCheckedChange={(checked) => setIsAmendment(checked === true)} disabled={loading} />
              <Label htmlFor="icegate-amendment" className="tw:cursor-pointer tw:font-semibold">Filing an Amendment (SCMTR / Custom Declaration)</Label>
            </div>
          ) : (
            <p className="tw:m-0 tw:rounded-md tw:border tw:border-dashed tw:border-input tw:bg-page tw:p-2.5 tw:text-entry tw:text-muted-foreground">
              Amending a BE? ICEGATE takes an amendment only as the CACHI01_A file - close this and use <strong>ACTIONS &gt; BE Amendment File</strong>.
            </p>
          )}

          {isAmendment && (
            <AmendmentFields
              amendmentType={amendmentType}
              onTypeChange={setAmendmentType}
              amendReason={amendReason}
              onReasonChange={setAmendReason}
              disabled={loading}
            />
          )}

          <Field label="🔑 DSC Token PIN" layout="col" note="Required to digitally sign the JSON (same mechanism as ICEGATE Common Signer Utility)">
            <Input
              type="password"
              placeholder="Enter your USB token PIN"
              value={tokenPin}
              onChange={(event) => setTokenPin(event.target.value)}
              disabled={loading}
              data-allow-text=""
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}
