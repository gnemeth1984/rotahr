"use client";

export default function PartnersPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0f1a; color: #fff; min-height: 100vh; }
        header { display: flex; align-items: center; justify-content: space-between; padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; background: rgba(10,15,26,0.95); backdrop-filter: blur(12px); z-index: 100; }
        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-text { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .header-cta { background: #f97316; color: #fff; border: none; padding: 10px 22px; border-radius: 100px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
        .hero { text-align: center; padding: 80px 24px 56px; }
        .hero-label { display: inline-block; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.3); padding: 5px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 20px; }
        .hero h1 { font-size: clamp(32px,5vw,56px); font-weight: 800; line-height: 1.1; letter-spacing: -1px; margin-bottom: 16px; }
        .hero h1 span { color: #f97316; }
        .hero p { font-size: 18px; color: rgba(255,255,255,0.55); max-width: 560px; margin: 0 auto; line-height: 1.7; }
        .how-it-works { max-width: 900px; margin: 0 auto; padding: 64px 24px; }
        .how-it-works h2 { text-align: center; font-size: 28px; font-weight: 800; margin-bottom: 48px; letter-spacing: -0.5px; }
        .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; }
        .step { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 24px; }
        .step-num { width: 36px; height: 36px; background: #f97316; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; margin-bottom: 16px; }
        .step h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .step p { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; }
        .ls-cta-section { max-width: 560px; margin: 0 auto; padding: 0 24px 80px; }
        .ls-cta-section h2 { font-size: 26px; font-weight: 800; margin-bottom: 8px; text-align: center; }
        .ls-cta-sub { text-align: center; color: rgba(255,255,255,0.45); font-size: 15px; margin-bottom: 32px; }
        .ls-cta-card { background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.25); border-radius: 20px; padding: 40px 36px; text-align: center; }
        .ls-btn { display: inline-block; background: #f97316; color: #fff; padding: 16px 36px; border-radius: 100px; font-size: 17px; font-weight: 700; text-decoration: none; transition: opacity 0.2s; margin-bottom: 16px; }
        .ls-btn:hover { opacity: 0.9; }
        .ls-features { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-top: 20px; font-size: 13px; color: rgba(255,255,255,0.45); }
        .ls-legal { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 20px; line-height: 1.7; text-align: left; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; }
        .ls-legal a { color: rgba(249,115,22,0.7); text-decoration: none; }
        .or-divider { text-align: center; color: rgba(255,255,255,0.25); font-size: 13px; margin: 28px 0 20px; letter-spacing: 1px; }
        .custom-form-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 28px; }
        .earnings { background: rgba(249,115,22,0.06); border: 1px solid rgba(249,115,22,0.2); border-radius: 20px; max-width: 860px; margin: 0 auto 80px; padding: 48px 32px; }
        .earnings h2 { text-align: center; font-size: 26px; font-weight: 800; margin-bottom: 8px; }
        .earnings-sub { text-align: center; color: rgba(255,255,255,0.45); font-size: 15px; margin-bottom: 36px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.8px; padding: 0 16px 12px; }
        td { padding: 16px; font-size: 15px; border-top: 1px solid rgba(255,255,255,0.06); }
        td:last-child { color: #f97316; font-weight: 700; }
        tr:hover td { background: rgba(255,255,255,0.02); }
        .form-section { max-width: 560px; margin: 0 auto; padding: 0 24px 80px; }
        .form-section h2 { font-size: 26px; font-weight: 800; margin-bottom: 8px; text-align: center; }
        .form-sub { text-align: center; color: rgba(255,255,255,0.45); font-size: 15px; margin-bottom: 32px; }
        .form-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px; }
        .field { margin-bottom: 20px; }
        label { display: block; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.6); margin-bottom: 8px; }
        input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 12px 16px; color: #fff; font-size: 15px; outline: none; transition: border 0.2s; }
        input:focus { border-color: #f97316; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        .submit-btn { width: 100%; background: #f97316; color: #fff; border: none; padding: 14px; border-radius: 100px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: opacity 0.2s; }
        .submit-btn:hover { opacity: 0.9; }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .success-msg { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; padding: 20px; text-align: center; color: #86efac; font-size: 15px; line-height: 1.6; }
        .error-msg { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 16px; text-align: center; color: #fca5a5; font-size: 14px; margin-top: 12px; }
        footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        footer p { font-size: 13px; color: rgba(255,255,255,0.3); }
        footer a { color: rgba(255,255,255,0.4); text-decoration: none; }
        @media (max-width: 600px) { header { padding: 16px 20px; } .form-card { padding: 24px; } .earnings { padding: 32px 20px; } }
      `}</style>

      <header>
        <a className="logo" href="/landing">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="20" fill="#0f172a" />
            <path d="M20 8C15 8 11 13 13 18C15 23 20 24 20 32C20 24 25 23 27 18C29 13 25 8 20 8Z" fill="url(#pg)" />
            <defs>
              <linearGradient id="pg" x1="20" y1="8" x2="20" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f97316" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">rotahr</span>
        </a>
        <a className="header-cta" href="#apply">Become a Partner</a>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-label">Partner Programme</div>
        <h1>Refer clients.<br /><span>Earn every month.</span></h1>
        <p>
          You already advise hospitality businesses on their finances.
          Recommend Rotahr and earn 20% recurring commission for every client you refer — for life.
        </p>
      </section>

      {/* How it works */}
      <div className="how-it-works">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <h3>Apply below</h3>
            <p>Fill in your details. We'll send you a unique referral link within 24 hours.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>Share with clients</h3>
            <p>Send your link to any restaurant, bar, café or hotel you work with.</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>They sign up</h3>
            <p>Your client starts their free trial. No credit card needed, no pressure.</p>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <h3>You get paid</h3>
            <p>20% of their monthly subscription, every month, for as long as they stay.</p>
          </div>
        </div>
      </div>

      {/* Earnings table */}
      <div style={{ padding: "0 24px" }}>
        <div className="earnings">
          <h2>What you can earn</h2>
          <p className="earnings-sub">Recurring monthly commission — no cap, no expiry</p>
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Client pays</th>
                <th>Your commission</th>
                <th>Per year per client</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Starter (up to 15 staff)</td>
                <td>€59/mo</td>
                <td>€11.80/mo</td>
                <td>€141.60/yr</td>
              </tr>
              <tr>
                <td>Pro (up to 30 staff)</td>
                <td>€119/mo</td>
                <td>€23.80/mo</td>
                <td>€285.60/yr</td>
              </tr>
              <tr>
                <td>Enterprise (unlimited)</td>
                <td>€215/mo</td>
                <td>€43/mo</td>
                <td>€516/yr</td>
              </tr>
            </tbody>
          </table>
          <p style={{ marginTop: "20px", fontSize: "13px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
            5 Pro clients = €1,200/yr passive income. 10 clients = €2,400/yr.
          </p>
        </div>
      </div>

      {/* Primary CTA — Lemon Squeezy affiliate signup */}
      <div className="ls-cta-section" id="apply">
        <h2>Join the programme</h2>
        <p className="ls-cta-sub">Free to join. Instant access. Payments handled automatically.</p>
        <div className="ls-cta-card">
          <a
            className="ls-btn"
            href="https://rotahr.lemonsqueezy.com/affiliates"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sign up as an Affiliate →
          </a>
          <div className="ls-features">
            <span>✓ Instant approval</span>
            <span>✓ Your own dashboard</span>
            <span>✓ Auto payments via Lemon Squeezy</span>
            <span>✓ Real-time click & conversion tracking</span>
          </div>
          <div className="ls-legal">
            <strong style={{ color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Legal &amp; Tax Notice</strong>
            Commission earned through this programme constitutes taxable income. As a partner, you are solely responsible for declaring your earnings to Revenue (Ireland) or the relevant tax authority in your jurisdiction. Rotahr does not deduct tax at source. Payments are processed and disbursed by Lemon Squeezy, Inc. (our merchant of record) — not directly by Rotahr. Rotahr will file Form 46G with Irish Revenue at year end for qualifying payments made to Irish residents, as required by TCA 1997 s.889. By signing up, you confirm you understand and accept these obligations. See our full{" "}
            <a href="/terms#affiliate">Partner Programme Terms</a>.
          </div>
        </div>

        <div className="or-divider">— OR —</div>

        <p style={{ textAlign: "center", fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "20px" }}>
          Want to discuss the programme before signing up? Leave your details and we'll reach out.
        </p>
        <div className="custom-form-card">
          <PartnerForm />
        </div>
      </div>

      <footer>
        <p>© 2026 Rotahr. Built for hospitality.</p>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="/landing">Home</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </>
  );
}

function PartnerForm() {
  const [state, setState] = require("react").useState("idle" as "idle"|"loading"|"success"|"error");
  const [error, setError] = require("react").useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          company: fd.get("company"),
          phone: fd.get("phone"),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Something went wrong");
      }
      setState("success");
    } catch (err: any) {
      setError(err.message);
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="success-msg">
        <strong style={{ display: "block", marginBottom: "8px", fontSize: "17px" }}>You're in! 🎉</strong>
        We'll send your unique referral link to your email within 24 hours.<br />
        Questions? Email <a href="mailto:hello@rotahr.com" style={{ color: "#f97316" }}>hello@rotahr.com</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Your name *</label>
        <input name="name" placeholder="Jane Murphy" required />
      </div>
      <div className="field">
        <label>Email address *</label>
        <input name="email" type="email" placeholder="jane@youfirm.ie" required />
      </div>
      <div className="field">
        <label>Firm / Company name</label>
        <input name="company" placeholder="Murphy Accountants Ltd" />
      </div>
      <div className="field">
        <label>Phone (optional)</label>
        <input name="phone" placeholder="+353 87 000 0000" />
      </div>
      <button className="submit-btn" type="submit" disabled={state === "loading"}>
        {state === "loading" ? "Sending..." : "Apply to Partner →"}
      </button>
      {state === "error" && <div className="error-msg">{error}</div>}
    </form>
  );
}
