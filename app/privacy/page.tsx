"use client";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: June 2025</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700">

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">1. Who we are</h2>
            <p>
              Rotahr is a hospitality workforce management platform operated by Rotahr Ltd.
              For the purposes of GDPR, Rotahr Ltd. is the <strong>data controller</strong> for platform-level
              data. Individual businesses using Rotahr are <strong>data processors</strong> for data they collect
              about their customers and staff.
            </p>
            <p className="mt-2">
              Contact: <a href="mailto:privacy@rotahr.com" className="text-blue-600 hover:underline">privacy@rotahr.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">2. What data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data:</strong> name, email address, hashed password, role.</li>
              <li><strong>Employee data:</strong> name, email, phone, hourly rate, shift records, time-off requests, availability, clock-in/out events (including GPS coordinates where enabled).</li>
              <li><strong>Customer booking data:</strong> name, email, phone, party size, date/time, dietary requirements, occasion notes.</li>
              <li><strong>Financial data:</strong> expense records, VAT amounts, supplier names, receipt images (stored temporarily), supplier VAT numbers.</li>
              <li><strong>Usage data:</strong> authentication logs, session tokens.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">3. Lawful basis for processing</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Financial and tax records</strong> — processed under <strong>GDPR Art.6(1)(c)</strong> (legal obligation).
                Irish Revenue requires retention of VAT records and financial records for a minimum of <strong>6 years</strong>
                under the Taxes Consolidation Act 1997, s.886. These records are <em>never deleted</em>.
              </li>
              <li>
                <strong>Employee workforce data</strong> (shifts, wages, time off) — processed under <strong>GDPR Art.6(1)(b)</strong>
                (contract performance) and <strong>Art.6(1)(c)</strong> (legal obligation under employment law).
              </li>
              <li>
                <strong>Customer booking data</strong> — processed under <strong>GDPR Art.6(1)(f)</strong> (legitimate interest)
                to fulfil and manage reservations. PII is anonymised upon deletion.
              </li>
              <li>
                <strong>Location data (clock-in/out)</strong> — processed under <strong>GDPR Art.6(1)(b)</strong>
                (contract performance, geofencing for attendance verification). Retained for 12 months then purged.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">4. Data retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Financial/VAT records:</strong> retained permanently (minimum 6 years per TCA 1997 s.886).</li>
              <li><strong>Receipt images:</strong> base64 preview copy purged after 30 days; Vercel Blob copy retained per your Blob storage settings.</li>
              <li><strong>Customer PII (bookings):</strong> anonymised on deletion — financial booking record is retained.</li>
              <li><strong>Clock-in location data:</strong> purged after 12 months.</li>
              <li><strong>Staff messages:</strong> retained for 12 months, then subject to deletion.</li>
              <li><strong>Account data:</strong> retained for the duration of the business subscription, deleted within 90 days of account closure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">5. Your rights under GDPR</h2>
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
              Note: the right to erasure does not apply to records we are legally required to retain (e.g. VAT and payroll records under Irish tax law).
            </p>
            <p className="mt-2">
              To exercise your rights, email <a href="mailto:privacy@rotahr.com" className="text-blue-600 hover:underline">privacy@rotahr.com</a>.
              You also have the right to lodge a complaint with the <strong>Data Protection Commission (DPC)</strong> at{" "}
              <a href="https://www.dataprotection.ie" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dataprotection.ie</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">6. Data sharing</h2>
            <p>We do not sell personal data. Data may be shared with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Neon (database):</strong> PostgreSQL cloud hosting — EU data residency available.</li>
              <li><strong>Vercel (hosting + storage):</strong> serverless platform and Blob storage for receipt images.</li>
              <li><strong>OpenAI (optional):</strong> receipt image content is sent to GPT-4o for data extraction if AI reading is enabled. No data is used for model training.</li>
              <li><strong>Resend (email):</strong> used to send shift reminders and notifications.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">7. Security</h2>
            <p>
              Passwords are hashed using bcrypt (cost factor 12). All data in transit is encrypted via TLS.
              Database access is restricted by role and session. Receipt images stored in Vercel Blob use private
              access controls.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">8. Changes to this policy</h2>
            <p>
              We may update this policy. Material changes will be communicated via the platform. Continued use
              after changes constitutes acceptance.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
