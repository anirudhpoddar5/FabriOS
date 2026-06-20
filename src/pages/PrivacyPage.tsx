import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">1. Information We Collect</h2>
            <p>We collect information you provide when creating an account: name, email address, and company details. We also collect data you enter into the platform (orders, production entries, inventory data) as part of normal operation.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">2. How We Use Your Information</h2>
            <p>Your data is used exclusively to provide and improve the Service. We do not sell, rent, or share your personal information with third parties for their marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">3. Data Storage &amp; Security</h2>
            <p>Your data is stored securely on Supabase infrastructure with encryption in transit and at rest. We implement industry-standard security measures to protect against unauthorized access.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">4. Data Retention</h2>
            <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">5. Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use tracking cookies or third-party analytics.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">6. Third-Party Services</h2>
            <p>We use Supabase for database and authentication services. Supabase's privacy policy applies to the infrastructure layer. We do not integrate with any other third-party services that access your data.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">7. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. You can export your data via the platform's export features or request a full export by contacting us.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-2">8. Contact</h2>
            <p>For privacy-related inquiries, contact us at support@fabrios.app.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
