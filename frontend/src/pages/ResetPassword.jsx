// Opened from the e-mailed link /reset-password?token=... ; sets a new password.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input, Label } from '@/components/ui';
import { authApi } from './authApi';

const MIN_LENGTH = 8;
const PASSWORD_BOX = 'tw:h-auto tw:rounded-lg tw:py-3 tw:pr-10 tw:pl-10 tw:text-[15px]';

function PasswordBox({ id, label, children }) {
  return (
    <div className="tw:mb-3.5">
      <Label htmlFor={id} className="tw:mb-1.5 tw:font-semibold">{label}</Label>
      <div className="tw:relative">
        <Lock className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}

function Notice({ tone, children }) {
  return (
    <div className={cn('tw:mb-3.5 tw:rounded-lg tw:border tw:px-3 tw:py-2.5 tw:text-[13px]', tone === 'error' ? 'tw:border-destructive/30 tw:bg-destructive/10 tw:text-destructive' : 'tw:border-success/30 tw:bg-success/10 tw:text-success')}>
      {children}
    </div>
  );
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : 'This reset link is broken. Please ask for a new one from the login page.');
  const [done, setDone] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) { setError(`New password must be at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirmation) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      const answer = await authApi.resetPassword(token, password);
      setDone(answer?.message || 'Password changed.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (requestError) {
      const answer = requestError.response?.data;
      if (!requestError.response) setError('Cannot connect to server');
      else setError((typeof answer === 'object' && answer?.error) || 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tw:flex tw:min-h-screen tw:items-center tw:justify-center tw:bg-linear-135 tw:from-slate-900 tw:to-primary tw:p-4">
      <form onSubmit={submit} className="tw:w-full tw:max-w-[400px] tw:rounded-[14px] tw:bg-background tw:p-8 tw:shadow-2xl">
        <div className="tw:mb-1.5 tw:flex tw:items-center tw:gap-2.5">
          <ShieldCheck className="tw:size-[22px] tw:text-primary" />
          <h2 className="tw:m-0 tw:text-xl tw:text-foreground">Set a new password</h2>
        </div>
        <p className="tw:mt-0 tw:mb-[22px] tw:text-[13px] tw:text-muted-foreground">Committed Cargo Care - EagleView</p>

        {error && <Notice tone="error">{error}</Notice>}
        {done && <Notice tone="success">{done} Taking you to login...</Notice>}

        {!done && token && (
          <>
            <PasswordBox id="new-password" label="New password">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                autoComplete="new-password"
                placeholder="At least 8 characters"
                data-allow-text=""
                className={PASSWORD_BOX}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="tw:absolute tw:top-1/2 tw:right-2 tw:-translate-y-1/2 tw:text-muted-foreground tw:hover:bg-transparent"
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOff className="tw:size-[18px]" /> : <Eye className="tw:size-[18px]" />}
              </Button>
            </PasswordBox>
            <PasswordBox id="confirm-password" label="Confirm new password">
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                data-allow-text=""
                className={PASSWORD_BOX}
              />
            </PasswordBox>
            <Button type="submit" variant="default" size="lg" disabled={busy} className="tw:mt-1.5 tw:h-auto tw:w-full tw:rounded-lg tw:py-3 tw:text-[15px] tw:font-bold">
              {busy ? 'Saving...' : 'Save new password'}
            </Button>
          </>
        )}
        <p className="tw:mt-[18px] tw:text-center">
          <Button variant="link" className="tw:text-[13px]" onClick={() => navigate('/login')}>Back to login</Button>
        </p>
      </form>
    </div>
  );
}
