"use client";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: June 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">1. Who we are</h2>
            <p>
              Rotahr is a hospitality workforce management platform operated by Rotahr, Ireland.
              For the purposes of GDPR, Rotahr is the <strong>data controller</strong> for platform-level data
              (account data, subscription data, platform usage). Individual businesses using Rotahr act as
              <strong> data controllers</strong> for data they collect about their own customers and staff;
              Rotahr acts as a <strong>data processor</strong> on their behalf in relation to that data.
            </p>
            <p className="mt-2">
              Contact: <a href="mailto:privacy@rotahr.com" className="text-blue-600 hover:underline">privacy@rotahr.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">2. What data we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account data:</strong> name, email address, hashed password (bcrypt, cost 12), role, business name.
              </li>
              <li>
                <strong>Employee HR data (collected by businesses on their staff):</strong> name, email, phone, home address,
                start date, contract type, hourly rate, PPS Number (masked in UI), IBAN and BIC (masked in UI),
                emergency contact name/phone/relationship, shift records, time-off requests, availability preferences,
                clock-in/out events (with optional GPS coordinates), certifications, documents uploaded by managers.
              </li>
              <li>
                <strong>Customer booking data:</strong> name, email, phone, party size, date/time, occasion notes, dietary/menu notes.
              </li>
              <li>
                <strong>Financial data:</strong> expense records, VAT amounts, supplier names and VAT numbers,
                receipt images (temporarily), supplier invoice data, stock item prices and purchase history,
                wastage records (item name, quantity, date, reason, estimated cost), recipe and ingredient data
                (names, quantities, unit costs, GP% calculations). This data is stored solely to provide cost
                management features and is not shared with third parties. You can delete any wastage record or
                recipe at any time from within the platform.
              </li>
              <li>
                <strong>Payment data:</strong> subscription status, plan type. Payment card processing is handled
                entirely by Lemon Squeezy — Rotahr does not store card numbers or full payment details.
              </li>
              <li>
                <strong>Usage data:</strong> authentication logs, session tokens, error logs.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">3. Lawful basis for processing</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account and subscription data</strong> — <strong>GDPR Art.6(1)(b)</strong> (contract performance)
                and <strong>Art.6(1)(f)</strong> (legitimate interest in operating the platform).
              </li>
              <li>
                <strong>Employee HR and payroll data</strong> (shifts, wages, time off, PPS Number, IBAN) —
                <strong> GDPR Art.6(1)(b)</strong> (performance of employment contract) and
                <strong> Art.6(1)(c)</strong> (legal obligation under Terms of Employment Act 1994,
                National Minimum Wage Act 2000, Payment of Wages Act 1991, and Revenue obligations under
                Taxes Consolidation Act 1997 s.886). Payroll records must be retained for a minimum of
                <strong> 6 years</strong> under Irish law.
              </li>
              <li>
                <strong>Emergency contact data</strong> — <strong>GDPR Art.6(1)(f)</strong> (legitimate interest —
                health and safety in the workplace under Safety, Health and Welfare at Work Act 2005).
              </li>
              <li>
                <strong>Customer booking data</strong> — <strong>GDPR Art.6(1)(f)</strong> (legitimate interest
                in managing reservations). PII is anonymised on deletion; financial booking record is retained.
              </li>
              <li>
                <strong>Clock-in/out location data</strong> — <strong>GDPR Art.6(1)(b)</strong> (contract performance;
                geofencing for attendance verification). Retained for 12 months, then purged.
              </li>
              <li>
                <strong>Financial/VAT records</strong> — <strong>GDPR Art.6(1)(c)</strong> (legal obligation).
                Irish Revenue requires retention for a minimum of <strong>6 years</strong> (TCA 1997 s.886).
                These records are never permanently deleted.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4. Data retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Payroll and HR records (PPS, IBAN, shifts, wages):</strong> retained for minimum 6 years per TCA 1997 s.886 and Irish employment law. Cannot be deleted during this period.</li>
              <li><strong>Financial/VAT records:</strong> retained permanently (minimum 6 years, no maximum under Irish Revenue rules).</li>
              <li><strong>Receipt images:</strong> base64 preview purged after 30 days by automated cron; Vercel Blob copy subject to your Blob storage settings.</li>
              <li><strong>Customer PII (bookings/CRM):</strong> anonymised on deletion — booking record (financial) retained. Full anonymisation available on request to comply with GDPR Art.17.</li>
              <li><strong>Clock-in location data:</strong> purged after 12 months.</li>
              <li><strong>Staff messages:</strong> retained for 12 months, then subject to deletion.</li>
              <li><strong>Account data:</strong> retained for the duration of the business subscription. Deleted within 90 days of confirmed account closure, except where legal retention obligations apply.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">5. Employee data — notice to staff</h2>
            <p>
              If you are an employee whose data has been entered into Rotahr by your employer, your employer
              (the business) is the data controller for your personal data. Your employer is responsible for
              informing you of what data is held and why. Rotahr processes this data on behalf of your
              employer as a data processor.
            </p>
            <p className="mt-2">
              The following personal data may be stored: your name, contact details, home address, employment
              start date, contract type, hourly rate, PPS Number, IBAN/BIC (for payroll), emergency contact,
              shift and attendance records, time-off requests, and training/certification records.
            </p>
            <p className="mt-2">
              Sensitive fields (PPS Number, IBAN) are masked in the platform and only accessible to authorised
              managers and administrators within your employer's account.
            </p>
            <p className="mt-2">
              To request access to, correction of, or deletion of your data, contact your employer directly
              or email <a href="mailto:privacy@rotahr.com" className="text-blue-600 hover:underline">privacy@rotahr.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">6. Your rights under GDPR</h2>
            <p>As a data subject, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access</strong> your personal data (Art.15)</li>
              <li><strong>Rectification</strong> of inaccurate data (Art.16)</li>
              <li><strong>Erasure</strong> ("right to be forgotten") where no legal obligation to retain (Art.17)</li>
              <li><strong>Restrict processing</strong> (Art.18)</li>
              <li><strong>Data portability</strong> (Art.20)</li>
              <li><strong>Object to processing</strong> (Art.21)</li>
            </ul>
            <p className="mt-2">
              <strong>Note:</strong> The right to erasure does not apply to records we are legally required to retain —
              including payroll records (6 years), VAT/financial records, and any data subject to Irish Revenue or
              employment law obligations.
            </p>
            <p className="mt-2">
              To exercise your rights, email <a href="mailto:privacy@rotahr.com" className="text-blue-600 hover:underline">privacy@rotahr.com</a>.
              You also have the right to lodge a complaint with the <strong>Data Protection Commission (DPC)</strong> at{" "}
              <a href="https://www.dataprotection.ie" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dataprotection.ie</a>.
              UK residents may contact the <strong>ICO</strong> at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ico.org.uk</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">7. Data sharing and sub-processors</h2>
            <p>We do not sell personal data. Data is shared only with the following sub-processors to operate the platform:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Neon (database hosting):</strong> PostgreSQL cloud — data processed in EU/US. Neon is GDPR-compliant and provides EU data residency options.</li>
              <li><strong>Vercel (hosting + Blob storage):</strong> Platform hosting and receipt image storage. Vercel operates under EU-US Data Privacy Framework.</li>
              <li><strong>OpenAI (optional AI features):</strong> Receipt content is sent to GPT-4o for data extraction only when AI reading is enabled. OpenAI does not use this data for model training (zero data retention policy via API).</li>
              <li><strong>Resend (transactional email):</strong> Used for shift notifications, booking confirmations, and account emails. GDPR-compliant.</li>
              <li><strong>Lemon Squeezy (payments):</strong> Subscription billing and payment processing. Lemon Squeezy is the Merchant of Record and handles all payment card data under PCI DSS. Rotahr does not store card details.</li>
              <li><strong>Railway (email marketing infrastructure):</strong> Used to send opt-in marketing communications to prospective business customers. Not used for employee or end-customer data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">8. Security</h2>
            <p>
              Passwords are hashed using bcrypt (cost factor 12). All data in transit is encrypted via TLS 1.2+.
              Database access is restricted by role and business-scoped session. Sensitive fields (PPS Number, IBAN)
              are masked in the UI and only revealable by authorised users. Receipt images are stored in private
              Vercel Blob with access-controlled URLs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">9. Cookies</h2>
            <p>
              Rotahr uses only essential session cookies required for authentication. No advertising or tracking
              cookies are used. No third-party analytics scripts are loaded on the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">10. International transfers</h2>
            <p>
              Some sub-processors (Vercel, OpenAI, Lemon Squeezy) may process data outside the EEA. Where this occurs,
              transfers are protected by Standard Contractual Clauses (SCCs) or the EU-US Data Privacy Framework.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">11. Changes to this policy</h2>
            <p>
              We may update this policy. Material changes will be communicated via the platform dashboard and/or email.
              The date at the top of this page indicates when it was last revised. Continued use after changes
              constitutes acceptance.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
