"use client";

import { useEffect } from "react";

export default function PitchPage() {
  const slides = [
    "/pitch-slides/slide-01.png",
    "/pitch-slides/slide-02.png",
    "/pitch-slides/slide-03.png",
    "/pitch-slides/slide-04.png",
    "/pitch-slides/slide-05.png",
    "/pitch-whats-new-slide.png",
    "/pitch-slides/slide-07.png",
    "/pitch-slides/slide-08.png",
    "/pitch-slides/slide-09.png",
    "/pitch-compare-slide.png",
    "/pitch-pricing-slide.png",
    "/pitch-slides/slide-11-new.png",
    "partner-programme", // rendered as inline card
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
        if (dist < closestDist) {
          closestDist = dist;
          closest = slide;
        }
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
        .hero p { font-size: 18px; color: rgba(255,255,255,0.55); max-width: 520px; margin: 0 auto 32px; line-height: 1.6; }
        .btn-primary { background: #f97316; color: #fff; padding: 14px 28px; border-radius: 100px; font-size: 15px; font-weight: 600; text-decoration: none; }
        .slides-stack { max-width: 1100px; margin: 0 auto; padding: 8px 24px 48px; display: flex; flex-direction: column; gap: 12px; }
        .slide-item { width: 100%; border-radius: 16px; overflow: hidden; opacity: 1; transform: scale(0.98); transition: transform 0.4s ease, box-shadow 0.4s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06); }
        .slide-item.active { transform: scale(1); box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 2px rgba(249,115,22,0.4); }
        .slide-item img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; }
        .partner-slide { aspect-ratio: 16/9; background: linear-gradient(135deg, #0f172a 0%, #1a0a2e 50%, #0a1f10 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; position: relative; overflow: hidden; }
        .partner-slide::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(249,115,22,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(34,197,94,0.08) 0%, transparent 60%); }
        .partner-slide-inner { position: relative; z-index: 1; text-align: center; max-width: 800px; }
        .partner-badge { display: inline-block; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.35); padding: 5px 16px; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 24px; }
        .partner-title { font-size: clamp(24px,3.5vw,44px); font-weight: 800; line-height: 1.1; letter-spacing: -0.5px; margin-bottom: 12px; }
        .partner-title span { color: #f97316; }
        .partner-sub { font-size: clamp(13px,1.5vw,17px); color: rgba(255,255,255,0.5); margin-bottom: 36px; line-height: 1.5; }
        .partner-cards { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 32px; }
        .pcard { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px 20px; min-width: 150px; }
        .pcard-plan { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .pcard-commission { font-size: 22px; font-weight: 800; color: #f97316; }
        .pcard-sub { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .partner-url { display: inline-flex; align-items: center; gap: 8px; background: #f97316; color: #fff; padding: 12px 28px; border-radius: 100px; font-size: 14px; font-weight: 700; text-decoration: none; }
        .stats { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; padding: 48px 24px; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); }
        .stat { text-align: center; }
        .stat-num { font-size: 36px; font-weight: 800; color: #f97316; line-height: 1; }
        .stat-label { font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 6px; }
        .bottom-cta { text-align: center; padding: 64px 24px 80px; }
        .bottom-cta h2 { font-size: clamp(28px,4vw,44px); font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px; }
        .bottom-cta h2 span { color: #f97316; }
        .bottom-cta p { color: rgba(255,255,255,0.5); font-size: 16px; margin-bottom: 32px; }
        .trust-badges { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-top: 24px; }
        .badge { font-size: 12px; color: rgba(255,255,255,0.4); }
        footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        footer p { font-size: 13px; color: rgba(255,255,255,0.3); }
        footer a { color: rgba(255,255,255,0.4); text-decoration: none; }
        @media (max-width: 600px) { header { padding: 16px 20px; } .slides-stack { padding: 8px 12px 40px; gap: 8px; } footer { flex-direction: column; text-align: center; } }
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
        <div className="hero-label">Pitch Deck · 13 Slides</div>
        <h1>One app to run<br /><span>your entire venue</span></h1>
        <p>Rotas · Clock-In · Reservations · Bookkeeping · CRM · Menu Specials · POS Integration — built for Irish hospitality.</p>
        <a className="btn-primary" href="/auth/signin">Check Our Demo</a>
      </section>

      <div className="slides-stack">
        {slides.map((src, i) =>
          src === "partner-programme" ? (
            <div key={i} className="slide-item">
              <div className="partner-slide">
                <div className="partner-slide-inner">
                  <div className="partner-badge">Slide 13 · Partner Programme</div>
                  <div className="partner-title">Earn with Rotahr.<br /><span>20% recurring commission.</span></div>
                  <p className="partner-sub">
                    Accountants, consultants, hospitality advisors — refer clients and earn every month they stay.
                    Payments automated via Lemon Squeezy. No admin, no chasing invoices.
                  </p>
                  <div className="partner-cards">
                    <div className="pcard">
                      <div className="pcard-plan">Starter</div>
                      <div className="pcard-commission">€11.80/mo</div>
                      <div className="pcard-sub">per client · forever</div>
                    </div>
                    <div className="pcard">
                      <div className="pcard-plan">Pro</div>
                      <div className="pcard-commission">€23.80/mo</div>
                      <div className="pcard-sub">per client · forever</div>
                    </div>
                    <div className="pcard">
                      <div className="pcard-plan">Enterprise</div>
                      <div className="pcard-commission">€43/mo</div>
                      <div className="pcard-sub">per client · forever</div>
                    </div>
                  </div>
                  <a className="partner-url" href="https://rotahr.lemonsqueezy.com/affiliates" target="_blank" rel="noopener noreferrer">
                    rotahr.lemonsqueezy.com/affiliates →
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="slide-item">
              <img src={src} alt={`Slide ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
            </div>
          )
        )}
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
          <span className="badge">🔒 GDPR Compliant</span>
          <span className="badge">🌍 Built for Hospitality</span>
          <span className="badge">✓ No Setup Fees</span>
          <span className="badge">📱 iOS &amp; Android</span>
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
