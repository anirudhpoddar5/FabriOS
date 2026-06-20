import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';

export default function PendingApproval() {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">fabriOS</h1>
        </div>
        <Card className="shadow-sm">
          <CardContent className="pt-8 pb-6 px-6">
            <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <h2 className="text-base font-semibold mb-1">Pending Approval</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Your account is awaiting admin approval. You'll receive access once an administrator approves your request.
            </p>
            <p className="text-xs text-muted-foreground mb-4">{profile?.email}</p>
            <Button variant="outline" onClick={signOut} className="h-9">
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
