import { useState } from 'react';
import { Box, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { startSession } from '@/services/session';
import { Button, Checkbox, Input, Label } from '@/components/ui';
import { authApi } from './authApi';

const REMEMBERED_USER_KEY = 'rememberedUserId';

const LOGIN_BOX = 'tw:h-auto tw:rounded-xl tw:border-border tw:bg-background tw:py-4 tw:text-base tw:shadow-xs tw:focus-visible:border-ring tw:focus-visible:ring-4 tw:focus-visible:ring-ring/15';
const FIELD_LABEL = 'tw:ml-1 tw:text-xs tw:font-bold tw:text-muted-foreground tw:uppercase';

// the server's JSON answer of a failed request, or null when the server could not be reached
const serverAnswer = (error) => {
  const answer = error.response?.data;
  return answer && typeof answer === 'object' ? answer : null;
};

function Notice({ tone, children }) {
  return (
    <div
      className={cn(
        'tw:mb-8 tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:px-4 tw:py-3 tw:text-sm tw:font-semibold',
        tone === 'error' ? 'tw:border-destructive/30 tw:bg-destructive/10 tw:text-destructive' : 'tw:border-success/30 tw:bg-success/10 tw:text-success'
      )}
    >
      <span className={cn('tw:size-1.5 tw:shrink-0 tw:rounded-full', tone === 'error' ? 'tw:bg-destructive' : 'tw:bg-success')} />
      {children}
    </div>
  );
}

function IconBox({ icon: Icon, children }) {
  return (
    <div className="tw:relative">
      <Icon className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-5 tw:size-[18px] tw:-translate-y-1/2 tw:text-muted-foreground" />
      {children}
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:flex tw:items-center tw:gap-2 tw:font-semibold tw:text-slate-50">
        <Icon className="tw:size-5 tw:text-sky-400" /> {title}
      </div>
      <div className="tw:text-[0.85rem] tw:text-slate-400">{text}</div>
    </div>
  );
}

function Branding() {
  return (
    <div className="tw:relative tw:hidden tw:flex-1 tw:flex-col tw:justify-center tw:overflow-hidden tw:bg-linear-135 tw:from-slate-900 tw:to-primary tw:px-16 tw:py-20 tw:text-white tw:lg:flex">
      <div className="tw:relative tw:z-10 tw:max-w-[600px]">
        <div className="tw:flex tw:min-h-[220px] tw:flex-col tw:justify-center">
          <h2 className="tw:mb-6 tw:text-[3.5rem] tw:leading-[1.1] tw:font-extrabold tw:tracking-[-1px] tw:text-white">
            <span className="tw:text-shadow-lg">EagleView</span> <br />
            <span className="tw:inline-block tw:bg-linear-to-r tw:from-slate-50 tw:to-sky-400 tw:bg-clip-text tw:text-transparent">Customs Clearance.</span>
          </h2>
          <p className="tw:mb-8 tw:min-h-20 tw:text-[1.15rem] tw:leading-[1.7] tw:font-normal tw:text-slate-200 tw:text-shadow-md">
            File Shipping Bills and Bills of Entry directly to ICEGATE. Experience lightning-fast assessments, automated duty calculations, and zero-delay cargo clearances.
          </p>
        </div>
        <div className="tw:flex tw:gap-10 tw:border-t tw:border-white/10 tw:pt-8">
          <Feature icon={ShieldCheck} title="Secure Access" text="Enterprise-grade security" />
          <Feature icon={Box} title="Global Tracking" text="Real-time logistics control" />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [userId, setUserId] = useState(() => localStorage.getItem(REMEMBERED_USER_KEY) || '');
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem(REMEMBERED_USER_KEY)));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // a login from outside the office asks for a 6-digit code e-mailed to the user: { id, sentTo }
  const [otp, setOtp] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  const handleForgot = async () => {
    if (!userId) {
      setError('Please enter your User ID first, then click Forgot?');
      return;
    }
    setError('');
    setSuccess('');
    try {
      const answer = await authApi.forgotPassword(userId);
      setSuccess(answer.message);
    } catch (requestError) {
      const answer = serverAnswer(requestError);
      setError(answer ? answer.error || 'Failed to reset password' : 'Cannot connect to server');
    }
  };

  const signIn = (answer) => {
    const user = answer.data ? answer.data.user : answer.user;
    startSession(answer.data ? answer.data.accessToken : answer.token, user);
    if (rememberMe) localStorage.setItem(REMEMBERED_USER_KEY, userId);
    else localStorage.removeItem(REMEMBERED_USER_KEY);
    // a Director (PO approver) lands on the POs waiting for his approval
    window.location.href = String(user?.role || '').toLowerCase() === 'director' ? '/purchase-management' : '/dashboard';
  };

  const startAgain = () => {
    setOtp(null);
    setOtpCode('');
    setSuccess('');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!userId || !password || (otp && !otpCode)) {
      setError('Please fill in all the fields.');
      return;
    }
    setLoading(true);
    try {
      const answer = otp
        ? await authApi.loginWithCode(otp.id, otpCode.trim())
        : await authApi.login({ username: userId, password });
      if (answer.otpRequired) {
        setOtp({ id: answer.otpId, sentTo: answer.sentTo });
        setOtpCode('');
        setSuccess(`${answer.message} (sent to ${answer.sentTo})`);
        return;
      }
      signIn(answer);
    } catch (requestError) {
      const answer = serverAnswer(requestError);
      if (!answer) {
        setError('Cannot connect to server. Please check your network.');
        return;
      }
      if (otp && answer.restart) {
        setOtp(null);
        setOtpCode('');
      }
      setError(answer.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tw:flex tw:min-h-screen tw:bg-page tw:font-sans">
      <Branding />

      <div className="tw:relative tw:flex tw:flex-1 tw:items-center tw:justify-center tw:bg-background tw:py-24 tw:lg:flex-[0_0_500px] tw:lg:py-0">
        <div className="tw:absolute tw:inset-x-0 tw:top-0 tw:z-30 tw:h-1 tw:bg-linear-to-r tw:from-ring tw:to-primary" />
        <img src="/logo.png" alt="Committed Cargo Care Limited" className="tw:absolute tw:top-8 tw:right-8 tw:z-20 tw:block tw:h-[35px] tw:mix-blend-multiply" />

        <div className="tw:relative tw:z-10 tw:w-full tw:max-w-[420px] tw:px-8">
          <h2 className="tw:mb-12 tw:text-center tw:text-4xl tw:font-extrabold tw:tracking-[-0.5px] tw:text-foreground">Welcome Back</h2>

          {error && <Notice tone="error">{error}</Notice>}
          {success && <Notice tone="success">{success}</Notice>}

          <form onSubmit={handleLogin}>
            <div className="tw:mb-6">
              <Label htmlFor="login-user" className={cn(FIELD_LABEL, 'tw:mb-2')}>User ID</Label>
              <IconBox icon={User}>
                <Input
                  id="login-user"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value.toUpperCase())}
                  placeholder="e.g. ADMIN"
                  autoComplete="username"
                  data-allow-text=""
                  className={cn(LOGIN_BOX, 'tw:pl-12 tw:font-semibold tw:tracking-wider')}
                />
              </IconBox>
            </div>

            <div className="tw:mb-6">
              <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between">
                <Label htmlFor="login-password" className={FIELD_LABEL}>Password</Label>
                <Button variant="link" className="tw:h-auto tw:text-[0.8rem]" onClick={handleForgot}>Forgot Password?</Button>
              </div>
              <IconBox icon={Lock}>
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                  data-allow-text=""
                  className={cn(LOGIN_BOX, 'tw:px-12')}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="tw:absolute tw:top-1/2 tw:right-3 tw:-translate-y-1/2 tw:text-muted-foreground tw:hover:bg-transparent"
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? <EyeOff className="tw:size-[18px]" /> : <Eye className="tw:size-[18px]" />}
                </Button>
              </IconBox>
            </div>

            {otp && (
              <div className="tw:mb-6">
                <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between tw:gap-2">
                  <Label htmlFor="otpCode" className={cn(FIELD_LABEL, 'tw:whitespace-normal')}>Login code (e-mailed to {otp.sentTo})</Label>
                  <Button variant="link" className="tw:h-auto tw:text-[0.8rem]" onClick={startAgain}>Start again</Button>
                </div>
                <Input
                  id="otpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  autoFocus
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className={cn(LOGIN_BOX, 'tw:px-4 tw:text-center tw:text-[1.4rem] tw:font-bold tw:tracking-[0.4em]')}
                />
              </div>
            )}

            <div className="tw:mb-8 tw:flex tw:items-center tw:gap-2">
              <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} className="tw:size-4" />
              <Label htmlFor="remember" className="tw:cursor-pointer tw:text-[0.85rem] tw:font-medium tw:text-muted-foreground">Remember my User ID</Label>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={loading}
              className="tw:h-auto tw:w-full tw:rounded-xl tw:border-0 tw:bg-linear-to-r tw:from-ring tw:to-primary tw:py-4 tw:text-base tw:font-bold tw:tracking-wider tw:uppercase tw:shadow-lg tw:transition-all tw:duration-300 tw:hover:-translate-y-0.5 tw:hover:shadow-xl"
            >
              {loading ? <span className="tw:text-sm">AUTHENTICATING...</span> : <><span>{otp ? 'Verify code' : 'Sign In'}</span><span>&rarr;</span></>}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
