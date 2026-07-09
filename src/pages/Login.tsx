import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, ArrowLeft, Mail, Lock, User, KeyRound, Factory } from 'lucide-react';

type View = 'sign-in' | 'sign-up' | 'forgot' | 'signup-success';

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<View>(searchParams.get('signup') === '1' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFieldErrors({});
  }, [view]);

  const validateSignIn = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password) errs.password = 'Password is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSignUp = () => {
    const errs: Record<string, string> = {};
    if (!displayName.trim()) errs.displayName = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignIn()) return;
    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error);
    setBusy(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUp()) return;
    setBusy(true);
    const { error } = await signUp(email, password, displayName);
    if (error) {
      toast.error(error);
    } else {
      setView('signup-success');
    }
    setBusy(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setFieldErrors({ email: 'Email is required' }); return; }
    setBusy(true);
    const { error } = await resetPassword(email);
    if (error) toast.error(error);
    else toast.success('Reset link sent to your email');
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-blue-500/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10 pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

      <Link to="/" className="absolute top-4 left-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors z-10">
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-md mb-3">
            <Factory className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">fabri<span className="text-primary">OS</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Production OS for Print &amp; Stitch</p>
        </div>

        <Card className="shadow-lg border-0 bg-card/90 backdrop-blur-sm">
          <CardHeader className="pb-0 pt-6 px-6">
            <h2 className="text-base font-semibold">
              {view === 'sign-in' && 'Welcome back'}
              {view === 'sign-up' && 'Create your account'}
              {view === 'forgot' && 'Reset password'}
              {view === 'signup-success' && 'Account created'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {view === 'sign-in' && 'Sign in to your FabriOS workspace'}
              {view === 'sign-up' && 'Get started with a free account'}
              {view === 'forgot' && "We'll send you a reset link"}
              {view === 'signup-success' && ''}
            </p>
          </CardHeader>
          <CardContent className="pt-4 px-6 pb-6">
            {view === 'sign-in' && (
              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }} placeholder="you@company.com" className={`pl-8 h-10 ${fieldErrors.email ? 'border-red-500' : ''}`} required />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }} placeholder="••••••••" className={`pl-8 h-10 ${fieldErrors.password ? 'border-red-500' : ''}`} required />
                  </div>
                  {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
                </div>
                <Button type="submit" className="w-full h-10 shadow-sm" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign in
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setView('forgot')}>Forgot password?</button>
                  <button type="button" className="text-primary hover:text-primary/80 font-medium transition-colors" onClick={() => setView('sign-up')}>Create account</button>
                </div>
              </form>
            )}

            {view === 'sign-up' && (
              <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={displayName} onChange={e => { setDisplayName(e.target.value); setFieldErrors(p => ({ ...p, displayName: '' })); }} placeholder="John Doe" className={`pl-8 h-10 ${fieldErrors.displayName ? 'border-red-500' : ''}`} required />
                  </div>
                  {fieldErrors.displayName && <p className="text-xs text-red-500">{fieldErrors.displayName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }} placeholder="you@company.com" className={`pl-8 h-10 ${fieldErrors.email ? 'border-red-500' : ''}`} required />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: '' })); }} placeholder="Min 6 characters" className={`pl-8 h-10 ${fieldErrors.password ? 'border-red-500' : ''}`} required minLength={6} />
                  </div>
                  {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Confirm Password *</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: '' })); }} placeholder="Re-enter password" className={`pl-8 h-10 ${fieldErrors.confirmPassword ? 'border-red-500' : ''}`} required />
                  </div>
                  {fieldErrors.confirmPassword && <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
                </div>
                <Button type="submit" className="w-full h-10 shadow-sm" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create account
                </Button>
                <div className="text-center">
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setView('sign-in')}>Already have an account? Sign in</button>
                </div>
              </form>
            )}

            {view === 'signup-success' && (
              <div className="text-center space-y-4 py-4">
                <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Your account has been created!</p>
                  <p className="text-xs text-muted-foreground mt-1">You can now sign in with your credentials.</p>
                </div>
                <Button className="w-full h-10 shadow-sm" onClick={() => setView('sign-in')}>
                  Go to Sign in
                </Button>
              </div>
            )}

            {view === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: '' })); }} placeholder="you@company.com" className={`pl-8 h-10 ${fieldErrors.email ? 'border-red-500' : ''}`} required />
                  </div>
                  {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                </div>
                <Button type="submit" className="w-full h-10 shadow-sm" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send reset link
                </Button>
                <div className="text-center">
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setView('sign-in')}>Back to sign in</button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
