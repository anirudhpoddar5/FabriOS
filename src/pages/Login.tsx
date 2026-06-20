import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error);
    setBusy(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error('Please enter your name'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
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
    setBusy(true);
    const { error } = await resetPassword(email);
    if (error) toast.error(error);
    else toast.success('Reset link sent to your email');
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <Link to="/" className="absolute top-4 left-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
        <ArrowLeft className="h-3 w-3" /> Home
      </Link>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">fabriOS</h1>
          <p className="text-sm text-muted-foreground mt-1">Production OS for Print &amp; Stitch</p>
        </div>

        <Card className="shadow-sm border">
          <CardHeader className="pb-0 pt-6 px-6">
            <h2 className="text-base font-semibold">
              {view === 'sign-in' && 'Sign in'}
              {view === 'sign-up' && 'Create account'}
              {view === 'forgot' && 'Reset password'}
              {view === 'signup-success' && 'Account created'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {view === 'sign-in' && 'Enter your credentials to continue'}
              {view === 'sign-up' && 'Sign up for a new account'}
              {view === 'forgot' && "We'll send you a reset link"}
              {view === 'signup-success' && ''}
            </p>
          </CardHeader>
          <CardContent className="pt-4 px-6 pb-6">
            {view === 'sign-in' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="h-10" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Password</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-10" required />
                </div>
                <Button type="submit" className="w-full h-10" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign in
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setView('forgot')}>Forgot password?</button>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setView('sign-up')}>Create account</button>
                </div>
              </form>
            )}

            {view === 'sign-up' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Full Name *</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="John Doe" className="h-10" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="h-10" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Password *</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="h-10" required minLength={6} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Confirm Password *</Label>
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="h-10" required />
                </div>
                <Button type="submit" className="w-full h-10" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create account
                </Button>
                <div className="text-center">
                  <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setView('sign-in')}>Already have an account? Sign in</button>
                </div>
              </form>
            )}

            {view === 'signup-success' && (
              <div className="text-center space-y-4 py-4">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">Your account has been created!</p>
                  <p className="text-xs text-muted-foreground mt-1">You can now sign in with your credentials.</p>
                </div>
                <Button className="w-full h-10" onClick={() => setView('sign-in')}>
                  Go to Sign in
                </Button>
              </div>
            )}

            {view === 'forgot' && (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="h-10" required />
                </div>
                <Button type="submit" className="w-full h-10" disabled={busy}>
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
