import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Check, ChevronRight, Building2, Users, Shirt, Printer, Scissors, ArrowRight, Loader2 } from 'lucide-react';

const STEPS = ['Company', 'Get Started'] as const;

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [personName, setPersonName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreateCompany = async () => {
    if (!companyName.trim()) { toast.error('Company name is required'); return; }
    if (!user) { toast.error('Not authenticated'); return; }
    setBusy(true);
    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName.trim(), created_by: user.id })
        .select()
        .single();

      if (companyError) throw companyError;

      // Update profile with company_id and name, set as approved
      const updateData: any = {
        company_id: company.id,
        approval_status: 'approved'
      };
      if (personName.trim()) updateData.display_name = personName.trim();

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Assign admin role - the new RLS policy allows first-time self-assignment
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin' as const });

      if (roleError && !roleError.message.includes('duplicate')) {
        console.warn('Role assignment warning:', roleError.message);
        // Non-fatal — continue
      }

      // Create onboarding progress
      await supabase
        .from('onboarding_progress')
        .insert({ company_id: company.id, company_done: true });

      await refreshProfile();
      toast.success('Company created successfully!');
      setStep(1);
    } catch (err: any) {
      console.error('Setup error:', err);
      toast.error(err.message || 'Failed to create company');
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">fabriOS</h1>
          <p className="text-sm text-muted-foreground mt-1">Let's set up your workspace</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${i <= step ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'}`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline">{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-0 pt-6 px-6">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Your Company</h2>
              </div>
              <p className="text-xs text-muted-foreground">Tell us about your business</p>
            </CardHeader>
            <CardContent className="pt-4 px-6 pb-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Name *</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Textiles" className="h-10" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Your Name</Label>
                <Input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="John Doe" className="h-10" />
              </div>
              <Button className="w-full h-10" onClick={handleCreateCompany} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-0 pt-6 px-6">
              <h2 className="text-base font-semibold">You're all set!</h2>
              <p className="text-xs text-muted-foreground">Your workspace is ready. You can set up the following areas from Settings anytime.</p>
            </CardHeader>
            <CardContent className="pt-4 px-6 pb-6 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Users, label: 'Buyers' },
                  { icon: Shirt, label: 'Fabrics' },
                  { icon: Printer, label: 'Printing Products' },
                  { icon: Scissors, label: 'Stitching Products' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 text-sm">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full h-10 mt-4" onClick={onComplete}>
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
