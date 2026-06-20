import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using FabriOS ("the Service"), you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. Description of Service</h2>
            <p>FabriOS is a production management platform for print and stitch manufacturing businesses. It provides order tracking, production entry, inventory management, BOM generation, dispatch tracking, and reporting capabilities.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. User Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate information during registration.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Acceptable Use</h2>
            <p>You agree not to misuse the Service, interfere with its operation, or use it for any unlawful purpose. We reserve the right to suspend accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Data Ownership</h2>
            <p>You retain all ownership of the data you enter into the Service. We do not claim any intellectual property rights over your business data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
            <p>The Service is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Service, including data loss or business interruption.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Contact</h2>
            <p>For questions about these terms, contact us at support@fabrios.app.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
