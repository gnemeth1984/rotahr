"use client";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: June 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">1. Agreement</h2>
            <p>
              By accessing or using Rotahr, you agree to these Terms of Service. If you are using Rotahr on
              behalf of a business, you confirm you have authority to bind that business to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">2. The service</h2>
            <p>
              Rotahr provides workforce and operations management tools for hospitality businesses, including
              rota scheduling, bookkeeping, booking management, stock control, and related features. The service
              is provided on a subscription basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">3. Accounts</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must notify us immediately of any unauthorised access.</li>
              <li>One business account per subscription; sub-accounts may be created for staff within your plan limits.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4. Subscriptions and billing</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Starter:</strong> €49/month (inc. 23% Irish VAT) — up to 10 staff</li>
              <li><strong>Pro:</strong> €99/month (inc. 23% Irish VAT) — up to 30 staff</li>
              <li><strong>Enterprise:</strong> €179+/month (inc. 23% Irish VAT) — unlimited staff, multi-venue</li>
            </ul>
            <p className="mt-2">
              Subscriptions are billed monthly. You may cancel at any time; cancellation takes effect at the
              end of the current billing period. No refunds for partial months.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4a. Right of withdrawal (Consumer Rights Act 2022)</h2>
            <p>
              If you are a <strong>consumer</strong> (i.e. an individual acting outside of a trade, business, craft or profession) and you subscribe to Rotahr online or by any other distance means, you have the right to withdraw from the contract without giving any reason within <strong>14 days</strong> from the date of your subscription (the "cooling-off period"), in accordance with the European Union (Consumer Information, Cancellation and Other Rights) Regulations 2013 and the Consumer Rights Act 2022.
            </p>
            <p className="mt-2">
              <strong>Waiver of cooling-off period:</strong> By starting to use Rotahr during the 14-day cooling-off period, you expressly request that the service begins immediately and you acknowledge that you lose your right of withdrawal once the service has been fully performed. Where the service has not been fully performed, you remain entitled to a pro-rata refund for the unused portion.
            </p>
            <p className="mt-2">
              To exercise your right of withdrawal, notify us within 14 days at <a href="mailto:legal@rotahr.com" className="text-blue-600 hover:underline">legal@rotahr.com</a> with your account name and the statement that you wish to withdraw. We will process any refund due within 14 days of receiving your notice.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Note: Most Rotahr subscribers are businesses (B2B). The right of withdrawal under this clause applies only to consumers as defined by Irish and EU consumer law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">5. Your data</h2>
            <p>
              You own your business data. We process it only to provide the service and as required by law.
              See our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> for full details
              including our obligations under GDPR and Irish Revenue rules.
            </p>
            <p className="mt-2">
              <strong>Financial records</strong> (expenses, VAT data) are subject to mandatory retention under
              TCA 1997 s.886 and cannot be permanently deleted, even upon account closure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the platform for unlawful purposes</li>
              <li>Attempt to access other businesses' data</li>
              <li>Reverse-engineer or resell the platform</li>
              <li>Upload malicious content or exploit security vulnerabilities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">7. AI features</h2>
            <p>
              AI-assisted features (receipt reading, booking intake, rota suggestions) are provided as aids
              only. You are responsible for reviewing and verifying all AI-generated content before acting on it.
              Rotahr accepts no liability for errors in AI output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by Irish law, Rotahr's liability for any claim arising from use
              of the platform is limited to the subscription fees paid in the 3 months preceding the claim.
              We are not liable for indirect, consequential, or special damages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">9. Governing law</h2>
            <p>
              These terms are governed by the laws of Ireland. Any disputes shall be subject to the exclusive
              jurisdiction of the Irish courts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">10. Contact</h2>
            <p>
              Questions about these terms: <a href="mailto:legal@rotahr.com" className="text-blue-600 hover:underline">legal@rotahr.com</a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
