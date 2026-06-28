"use client";

import { useEffect } from "react";

export default function PitchPage() {
  const slides = [
    "/pitch-slides/slide-01.png",
    "/pitch-slides/slide-02.png",
    "/pitch-slides/slide-03.png",
    "/pitch-slides/slide-04.png",
    "/pitch-slides/slide-05.png",
    "whats-new",        // inline HTML
    "/pitch-slides/slide-07.png",
    "/pitch-slides/slide-08.png",
    "/pitch-slides/slide-09.png",
    "compare",          // inline HTML
    "pricing",          // inline HTML
    "partner-programme", // inline HTML
  ];

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>(".slide-item");
    function updateActive() {
      const centerY = window.innerHeight / 2;
      let closest: Element | null = null;
      let closestDist = Infinity;
      items.forEach((slide) => {
        const rect = slide.getBoundingClientRect();
        const dist = Math.abs(rect.top + rect.height / 2 - centerY);
        if (dist < closestDist) { closestDist = dist; closest = slide; }
      });
      items.forEach((slide) => slide.classList.toggle("active", slide === closest));
    }
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    const t = setTimeout(updateActive, 100);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
      clearTimeout(t);
    };
  }, []);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0f1a; color: #fff; min-height: 100vh; }
        header { display: flex; align-items: center; justify-content: space-between; padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; background: rgba(10,15,26,0.95); backdrop-filter: blur(12px); z-index: 100; }
        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-text { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .header-cta { background: #f97316; color: #fff; border: none; padding: 10px 22px; border-radius: 100px; font-size: 14px; font-weight: 600; text-decoration: none; }
        .hero { text-align: center; padding: 64px 24px 48px; }
        .hero-label { display: inline-block; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.3); padding: 5px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 20px; }
        .hero h1 { font-size: clamp(32px,5vw,56px); font-weight: 800; line-height: 1.1; letter-spacing: -1px; margin-bottom: 16px; }
        .hero h1 span { color: #f97316; }
        .hero p { font-size: clamp(15px,2vw,18px); color: rgba(255,255,255,0.55); max-width: 520px; margin: 0 auto 32px; line-height: 1.6; }
        .btn-primary { background: #f97316; color: #fff; padding: 14px 28px; border-radius: 100px; font-size: 15px; font-weight: 600; text-decoration: none; display: inline-block; }
        .slides-stack { max-width: 1100px; margin: 0 auto; padding: 8px 24px 48px; display: flex; flex-direction: column; gap: 12px; }
        .slide-item { width: 100%; border-radius: 16px; overflow: hidden; opacity: 1; transform: scale(0.98); transition: transform 0.4s ease, box-shadow 0.4s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06); }
        .slide-item.active { transform: scale(1); box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 2px rgba(249,115,22,0.4); }
        .slide-item img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; }

        /* ── shared inline slide base ── */
        .inline-slide {
          width: 100%;
          background: linear-gradient(135deg, #0f172a 0%, #0c1220 60%, #0f172a 100%);
          padding: clamp(24px, 5vw, 56px) clamp(20px, 5vw, 64px);
          position: relative; overflow: hidden;
        }
        .inline-slide::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 20% 50%, rgba(249,115,22,0.08) 0%, transparent 55%),
                      radial-gradient(ellipse at 80% 50%, rgba(249,115,22,0.06) 0%, transparent 55%);
          pointer-events: none;
        }
        .slide-inner { position: relative; z-index: 1; }
        .slide-badge {
          display: inline-block; background: rgba(249,115,22,0.15); color: #f97316;
          border: 1px solid rgba(249,115,22,0.35); padding: 4px 14px; border-radius: 100px;
          font-size: clamp(10px,1.2vw,13px); font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
          margin-bottom: clamp(12px,2vw,24px);
        }
        .slide-title {
          font-size: clamp(22px,4vw,46px); font-weight: 800; letter-spacing: -0.5px; line-height: 1.1;
          margin-bottom: clamp(6px,1vw,12px); text-align: center;
        }
        .slide-title span { color: #f97316; }
        .slide-sub {
          font-size: clamp(13px,1.5vw,17px); color: rgba(255,255,255,0.45);
          text-align: center; margin-bottom: clamp(20px,3vw,44px); line-height: 1.5;
        }

        /* ── What's New slide ── */
        .wn-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
          gap: clamp(10px,1.5vw,18px);
        }
        .wn-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
          border-radius: 14px; padding: clamp(14px,2vw,24px);
        }
        .wn-card.hl { background: rgba(249,115,22,0.07); border-color: rgba(249,115,22,0.28); }
        .wn-new { display: inline-block; background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); font-size: clamp(9px,1vw,11px); font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; padding: 2px 7px; border-radius: 100px; margin-bottom: 8px; }
        .wn-icon { font-size: clamp(18px,2.5vw,26px); margin-bottom: 8px; }
        .wn-name { font-size: clamp(13px,1.5vw,16px); font-weight: 700; margin-bottom: 5px; }
        .wn-card.hl .wn-name { color: #f97316; }
        .wn-desc { font-size: clamp(11px,1.2vw,13px); color: rgba(255,255,255,0.5); line-height: 1.55; }

        /* ── Compare slide ── */
        .cmp-table { width: 100%; border-collapse: collapse; }
        .cmp-table th, .cmp-table td { padding: clamp(8px,1.2vw,14px) clamp(10px,1.5vw,22px); font-size: clamp(11px,1.3vw,15px); }
        .cmp-table thead th { font-weight: 700; text-align: center; }
        .cmp-table thead th.feat { text-align: left; color: rgba(255,255,255,0.4); font-weight: 400; font-size: clamp(10px,1.1vw,13px); }
        .cmp-table thead th.rh { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); border-bottom: none; border-radius: 10px 10px 0 0; color: #f97316; }
        .cmp-table thead th.oth { color: rgba(255,255,255,0.35); font-weight: 500; }
        .cmp-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.06); }
        .cmp-table tbody tr:last-child { border-bottom: none; }
        .cmp-table tbody td { color: rgba(255,255,255,0.7); }
        .cmp-table tbody td.feat { font-weight: 500; color: rgba(255,255,255,0.85); text-align: left; }
        .cmp-table tbody td.rh { background: rgba(249,115,22,0.05); border-left: 1px solid rgba(249,115,22,0.18); border-right: 1px solid rgba(249,115,22,0.18); text-align: center; color: #fff; }
        .cmp-table tbody tr:last-child td.rh { border-radius: 0 0 10px 10px; border-bottom: 1px solid rgba(249,115,22,0.18); }
        .cmp-table tbody td.oth { text-align: center; color: rgba(255,255,255,0.3); }
        .cmp-table .price-row td { font-weight: 700; }
        .cmp-table .price-row .rh { color: #f97316 !important; }
        .chk { color: #22c55e; font-size: clamp(13px,1.5vw,18px); }
        .crs { color: rgba(255,255,255,0.18); font-size: clamp(13px,1.5vw,18px); }

        /* ── Pricing slide ── */
        .price-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(220px,100%), 1fr));
          gap: clamp(12px,2vw,22px);
          max-width: 900px; margin: 0 auto;
        }
        .price-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px; padding: clamp(20px,3vw,36px) clamp(18px,2.5vw,30px);
          display: flex; flex-direction: column;
        }
        .price-card.feat { background: rgba(249,115,22,0.08); border-color: rgba(249,115,22,0.38); }
        .pop-tag { display: inline-block; background: #f97316; color: #fff; font-size: clamp(9px,1vw,11px); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 3px 10px; border-radius: 100px; margin-bottom: 10px; }
        .plan-label { font-size: clamp(10px,1.1vw,12px); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-bottom: 8px; }
        .price-card.feat .plan-label { color: #f97316; }
        .price-amount { font-size: clamp(34px,5vw,54px); font-weight: 900; letter-spacing: -2px; line-height: 1; }
        .price-amount sup { font-size: 0.4em; font-weight: 400; color: rgba(255,255,255,0.5); vertical-align: super; }
        .price-per { font-size: clamp(11px,1.2vw,14px); color: rgba(255,255,255,0.38); margin-bottom: clamp(16px,2vw,24px); margin-top: 4px; }
        .price-divider { height: 1px; background: rgba(255,255,255,0.08); margin-bottom: clamp(14px,1.8vw,20px); }
        .price-features { list-style: none; display: flex; flex-direction: column; gap: clamp(7px,1vw,10px); flex: 1; }
        .price-features li { font-size: clamp(11px,1.3vw,14px); color: rgba(255,255,255,0.7); display: flex; align-items: flex-start; gap: 7px; }
        .price-features li::before { content: '✓'; color: #f97316; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .price-footnote { text-align: center; font-size: clamp(11px,1.2vw,13px); color: rgba(255,255,255,0.28); margin-top: clamp(16px,2vw,28px); }

        /* ── Partner slide ── */
        .partner-slide { background: linear-gradient(135deg, #0f172a 0%, #1a0a2e 50%, #0a1f10 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: clamp(28px,5vw,56px) clamp(20px,5vw,56px); position: relative; overflow: hidden; text-align: center; }
        .partner-slide::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(249,115,22,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(34,197,94,0.08) 0%, transparent 60%); }
        .partner-inner { position: relative; z-index: 1; max-width: 780px; width: 100%; }
        .partner-badge { display: inline-block; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.35); padding: 5px 16px; border-radius: 100px; font-size: clamp(10px,1.2vw,13px); font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: clamp(14px,2vw,24px); }
        .partner-title { font-size: clamp(22px,4vw,44px); font-weight: 800; line-height: 1.1; letter-spacing: -0.5px; margin-bottom: 10px; }
        .partner-title span { color: #f97316; }
        .partner-sub { font-size: clamp(13px,1.5vw,17px); color: rgba(255,255,255,0.5); margin-bottom: clamp(22px,3vw,36px); line-height: 1.55; }
        .partner-cards { display: flex; gap: clamp(10px,1.5vw,16px); justify-content: center; flex-wrap: wrap; margin-bottom: clamp(20px,3vw,32px); }
        .pcard { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: clamp(14px,2vw,18px) clamp(14px,2vw,20px); min-width: 120px; }
        .pcard-plan { font-size: clamp(10px,1.1vw,12px); color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .pcard-commission { font-size: clamp(18px,2.5vw,22px); font-weight: 800; color: #f97316; }
        .pcard-sub { font-size: clamp(9px,1vw,11px); color: rgba(255,255,255,0.35); margin-top: 2px; }
        .partner-url { display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #fff; padding: clamp(10px,1.5vw,12px) clamp(18px,2.5vw,28px); border-radius: 100px; font-size: clamp(12px,1.4vw,14px); font-weight: 700; text-decoration: none; }

        /* ── Stats + footer ── */
        .stats { display: flex; justify-content: center; gap: clamp(20px,4vw,40px); flex-wrap: wrap; padding: 48px 24px; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .stat { text-align: center; }
        .stat-num { font-size: clamp(28px,4vw,36px); font-weight: 800; color: #f97316; line-height: 1; }
        .stat-label { font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 6px; }
        .bottom-cta { text-align: center; padding: 64px 24px 80px; }
        .bottom-cta h2 { font-size: clamp(28px,4vw,44px); font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px; }
        .bottom-cta h2 span { color: #f97316; }
        .bottom-cta p { color: rgba(255,255,255,0.5); font-size: 16px; margin-bottom: 32px; }
        .trust-badges { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-top: 24px; }
        .tbadge { font-size: 12px; color: rgba(255,255,255,0.4); }
        footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        footer p { font-size: 13px; color: rgba(255,255,255,0.3); }
        footer a { color: rgba(255,255,255,0.4); text-decoration: none; }
        @media (max-width: 600px) {
          header { padding: 16px 20px; }
          .slides-stack { padding: 8px 12px 40px; gap: 8px; }
          footer { flex-direction: column; text-align: center; }
        }
      `}</style>

      <header>
        <a className="logo" href="/landing">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="20" fill="#0f172a" />
            <path d="M20 8C15 8 11 13 13 18C15 23 20 24 20 32C20 24 25 23 27 18C29 13 25 8 20 8Z" fill="url(#g)" />
            <defs>
              <linearGradient id="g" x1="20" y1="8" x2="20" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f97316" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          <span className="logo-text">rotahr</span>
        </a>
        <a className="header-cta" href="/auth/signin">Check Our Demo</a>
      </header>

      <section className="hero">
        <div className="hero-label">Pitch Deck · 12 Slides</div>
        <h1>One app to run<br /><span>your entire venue</span></h1>
        <p>Rotas · Clock-In · Reservations · Bookkeeping · CRM · Menu Specials · POS Integration — built for Irish hospitality.</p>
        <a className="btn-primary" href="/auth/signin">Check Our Demo</a>
      </section>

      <div className="slides-stack">
        {slides.map((src, i) => {
          if (src === "whats-new") return (
            <div key={i} className="slide-item">
              <div className="inline-slide">
                <div className="slide-inner" style={{ textAlign: "center" }}>
                  <div className="slide-badge">What&apos;s New in 2026</div>
                  <div className="slide-title">Built for <span>Irish Hospitality</span></div>
                  <div className="slide-sub">Every feature driven by real feedback from Irish pub &amp; restaurant owners</div>
                  <div className="wn-grid">
                    <div className="wn-card hl"><div className="wn-new">New</div><div className="wn-icon">🤖</div><div className="wn-name">AI Booking Assistant</div><div className="wn-desc">Handles reservations 24/7, suggests staffing adjustments based on demand, auto-confirms and emails guests.</div></div>
                    <div className="wn-card hl"><div className="wn-new">New</div><div className="wn-icon">👥</div><div className="wn-name">CRM & Customer Profiles</div><div className="wn-desc">Auto-built from reservations. Track visits, no-shows, spend, and notes. GDPR-compliant with one-click anonymisation.</div></div>
                    <div className="wn-card hl"><div className="wn-new">New</div><div className="wn-icon">🍽️</div><div className="wn-name">Menu Specials</div><div className="wn-desc">Post daily specials, menu changes, and announcements. All staff see them instantly in the app.</div></div>
                    <div className="wn-card hl"><div className="wn-new">New</div><div className="wn-icon">🔗</div><div className="wn-name">POS Integration</div><div className="wn-desc">Connect Lightspeed or Square. Booking data flows into your till system. No double entry.</div></div>
                    <div className="wn-card"><div className="wn-icon">🧾</div><div className="wn-name">AI Receipt Scanning</div><div className="wn-desc">Photo a receipt, AI reads it and auto-fills expense details. VAT tracking included.</div></div>
                    <div className="wn-card"><div className="wn-icon">📱</div><div className="wn-name">Staff Mobile App</div><div className="wn-desc">iOS & Android. Push notifications for shifts, time-off approvals, rota changes and booking updates.</div></div>
                    <div className="wn-card"><div className="wn-icon">📊</div><div className="wn-name">Dashboard & Reporting</div><div className="wn-desc">Labour cost vs revenue, P&L, VAT report, CSV export. Weekly and monthly breakdowns.</div></div>
                    <div className="wn-card"><div className="wn-icon">🤝</div><div className="wn-name">Partner Programme</div><div className="wn-desc">Earn 20% recurring commission. Paid automatically via Lemon Squeezy. No admin.</div></div>
                  </div>
                </div>
              </div>
            </div>
          );

          if (src === "compare") return (
            <div key={i} className="slide-item">
              <div className="inline-slide">
                <div className="slide-inner" style={{ textAlign: "center" }}>
                  <div className="slide-badge">vs. The Alternatives</div>
                  <div className="slide-title">Rotahr vs. <span>Everything Else</span></div>
                  <div className="slide-sub">All-in-one vs. cobbling together 4 separate tools</div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="cmp-table">
                      <thead>
                        <tr>
                          <th className="feat">Feature</th>
                          <th className="rh">Rotahr</th>
                          <th className="oth">Deputy</th>
                          <th className="oth">7shifts</th>
                          <th className="oth">Pen & paper</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Rota & Scheduling", true, true, true, false],
                          ["AI Booking Assistant", true, false, false, false],
                          ["CRM & Customer Profiles", true, false, false, false],
                          ["Expense Tracking & Receipts", true, false, false, false],
                          ["Menu Specials & Announcements", true, false, false, false],
                          ["POS Integration", true, false, false, false],
                          ["iOS & Android Staff App", true, true, true, false],
                        ].map(([label, rh, dep, sev, pen]) => (
                          <tr key={String(label)}>
                            <td className="feat">{String(label)}</td>
                            <td className="rh">{rh ? <span className="chk">✓</span> : <span className="crs">✗</span>}</td>
                            <td className="oth">{dep ? <span className="chk">✓</span> : <span className="crs">✗</span>}</td>
                            <td className="oth">{sev ? <span className="chk">✓</span> : <span className="crs">✗</span>}</td>
                            <td className="oth">{pen ? <span className="chk">✓</span> : <span className="crs">✗</span>}</td>
                          </tr>
                        ))}
                        <tr className="price-row">
                          <td className="feat">Starting price (incl. VAT)</td>
                          <td className="rh" style={{ color: "#f97316" }}>€59/mo</td>
                          <td className="oth">€80+/mo</td>
                          <td className="oth">€70+/mo</td>
                          <td className="oth">Hidden cost</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );

          if (src === "pricing") return (
            <div key={i} className="slide-item">
              <div className="inline-slide">
                <div className="slide-inner" style={{ textAlign: "center" }}>
                  <div className="slide-badge">Pricing</div>
                  <div className="slide-title">Simple, <span>Transparent</span> Pricing</div>
                  <div className="slide-sub">All prices include 23% Irish VAT · No hidden fees · Cancel anytime</div>
                  <div className="price-grid">
                    <div className="price-card">
                      <div className="plan-label">Starter</div>
                      <div className="price-amount"><sup>€</sup>59</div>
                      <div className="price-per">per month · up to 10 staff</div>
                      <div className="price-divider" />
                      <ul className="price-features">
                        <li>Rota builder & scheduling</li>
                        <li>Staff app (iOS & Android)</li>
                        <li>Time off & availability</li>
                        <li>Messaging & announcements</li>
                        <li>Basic reporting</li>
                      </ul>
                    </div>
                    <div className="price-card feat">
                      <div className="pop-tag">Most Popular</div>
                      <div className="plan-label">Pro</div>
                      <div className="price-amount"><sup>€</sup>119</div>
                      <div className="price-per">per month · up to 30 staff</div>
                      <div className="price-divider" />
                      <ul className="price-features">
                        <li>Everything in Starter</li>
                        <li>AI booking assistant</li>
                        <li>CRM & customer profiles</li>
                        <li>Bookkeeping & receipts</li>
                        <li>Menu specials & POS</li>
                      </ul>
                    </div>
                    <div className="price-card">
                      <div className="plan-label">Enterprise</div>
                      <div className="price-amount"><sup>€</sup>215</div>
                      <div className="price-per">per month · unlimited staff</div>
                      <div className="price-divider" />
                      <ul className="price-features">
                        <li>Everything in Pro</li>
                        <li>Multi-venue support</li>
                        <li>Advanced analytics & P&L</li>
                        <li>Custom onboarding</li>
                        <li>Priority support</li>
                      </ul>
                    </div>
                  </div>
                  <div className="price-footnote">All prices include 23% Irish VAT · First month free on Starter & Pro</div>
                </div>
              </div>
            </div>
          );

          if (src === "partner-programme") return (
            <div key={i} className="slide-item">
              <div className="partner-slide">
                <div className="partner-inner">
                  <div className="partner-badge">Partner Programme</div>
                  <div className="partner-title">Earn with Rotahr.<br /><span>20% recurring commission.</span></div>
                  <p className="partner-sub">Accountants, consultants, hospitality advisors — refer clients and earn every month they stay. Payments automated via Lemon Squeezy. No admin, no chasing invoices.</p>
                  <div className="partner-cards">
                    <div className="pcard"><div className="pcard-plan">Starter</div><div className="pcard-commission">€11.80/mo</div><div className="pcard-sub">per client · forever</div></div>
                    <div className="pcard"><div className="pcard-plan">Pro</div><div className="pcard-commission">€23.80/mo</div><div className="pcard-sub">per client · forever</div></div>
                    <div className="pcard"><div className="pcard-plan">Enterprise</div><div className="pcard-commission">€43/mo</div><div className="pcard-sub">per client · forever</div></div>
                  </div>
                  <a className="partner-url" href="https://rotahr.lemonsqueezy.com/affiliates" target="_blank" rel="noopener noreferrer">
                    rotahr.lemonsqueezy.com/affiliates →
                  </a>
                </div>
              </div>
            </div>
          );

          return (
            <div key={i} className="slide-item">
              <img src={src} alt={`Slide ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
            </div>
          );
        })}
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-num">€290</div><div className="stat-label">avg. monthly saving vs. separate tools</div></div>
        <div className="stat"><div className="stat-num">4.8 hrs</div><div className="stat-label">saved per manager per week</div></div>
        <div className="stat"><div className="stat-num">12</div><div className="stat-label">tools replaced by one platform</div></div>
        <div className="stat"><div className="stat-num">€59</div><div className="stat-label">starting price incl. 23% VAT</div></div>
      </div>

      <section className="bottom-cta">
        <h2>Ready to simplify<br /><span>your venue?</span></h2>
        <p>First month free. No credit card required. Cancel anytime.</p>
        <a className="btn-primary" href="/auth/signin" style={{ fontSize: "16px", padding: "16px 36px" }}>
          Check Our Demo — rotahr.com
        </a>
        <div className="trust-badges">
          <span className="tbadge">🔒 GDPR Compliant</span>
          <span className="tbadge">🌍 Built for Hospitality</span>
          <span className="tbadge">✓ No Setup Fees</span>
          <span className="tbadge">📱 iOS &amp; Android</span>
        </div>
      </section>

      <footer>
        <p>© 2026 Rotahr. Built for hospitality.</p>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="/landing">rotahr.com</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </footer>
    </>
  );
}
