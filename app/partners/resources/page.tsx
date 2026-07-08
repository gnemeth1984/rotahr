"use client";

export default function AffiliateResourcesPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0f1a; color: #fff; min-height: 100vh; }
        header { display: flex; align-items: center; justify-content: space-between; padding: 20px 40px; border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; background: rgba(10,15,26,0.95); backdrop-filter: blur(12px); z-index: 100; }
        .logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .logo-text { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .header-cta { background: #f97316; color: #fff; border: none; padding: 10px 22px; border-radius: 100px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
        .back-link { display: block; max-width: 900px; margin: 32px auto 0; padding: 0 24px; font-size: 14px; color: rgba(255,255,255,0.4); text-decoration: none; }
        .back-link:hover { color: rgba(255,255,255,0.7); }
        .hero { text-align: center; padding: 40px 24px 56px; }
        .hero-label { display: inline-block; background: rgba(249,115,22,0.15); color: #f97316; border: 1px solid rgba(249,115,22,0.3); padding: 5px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 20px; }
        .hero h1 { font-size: clamp(30px,4.5vw,48px); font-weight: 800; line-height: 1.1; letter-spacing: -1px; margin-bottom: 16px; }
        .hero h1 span { color: #f97316; }
        .hero p { font-size: 17px; color: rgba(255,255,255,0.55); max-width: 560px; margin: 0 auto; line-height: 1.7; }
        .kit { max-width: 900px; margin: 0 auto; padding: 0 24px 100px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px; display: flex; flex-direction: column; }
        .card-icon { width: 52px; height: 52px; border-radius: 14px; background: rgba(249,115,22,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 24px; }
        .card h3 { font-size: 20px; font-weight: 800; margin-bottom: 10px; }
        .card p { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.7; margin-bottom: 24px; flex: 1; }
        .card-meta { font-size: 12px; color: rgba(255,255,255,0.35); margin-bottom: 16px; }
        .dl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #f97316; color: #fff; padding: 13px 24px; border-radius: 100px; font-size: 14px; font-weight: 700; text-decoration: none; transition: opacity 0.2s; }
        .dl-btn:hover { opacity: 0.9; }
        .tip { max-width: 700px; margin: 0 auto 80px; padding: 0 24px; text-align: center; }
        .tip p { font-size: 14px; color: rgba(255,255,255,0.4); line-height: 1.7; }
        footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        footer p { font-size: 13px; color: rgba(255,255,255,0.3); }
        footer a { color: rgba(255,255,255,0.4); text-decoration: none; }
        @media (max-width: 600px) { header { padding: 16px 20px; } .card { padding: 28px 22px; } }
      `}</style>

      <header>
        <a href="/" className="logo">
          <span className="logo-text">🔥 Rotahr</span>
        </a>
        <a href="/partners" className="header-cta">Partner Programme</a>
      </header>

      <a href="/partners" className="back-link">← Back to Partner Programme</a>

      <div className="hero">
        <span className="hero-label">Affiliate resource kit</span>
        <h1>Everything to <span>pitch Rotahr</span></h1>
        <p>
          Download the pitch deck and product walkthrough guide — built for affiliates sharing
          Rotahr with restaurants, bars, cafés and hotels.
        </p>
      </div>

      <div className="kit">
        <div className="card">
          <div className="card-icon">📊</div>
          <h3>Rotahr Pitch Deck</h3>
          <p>
            A 12-slide overview covering the problem, the product, pricing, and the partner
            programme — perfect for sending to a prospect or presenting live.
          </p>
          <div className="card-meta">PDF · 12 slides</div>
          <a href="/affiliate-resources/Rotahr-Pitch-Deck.pdf" download className="dl-btn">
            Download pitch deck
          </a>
        </div>

        <div className="card">
          <div className="card-icon">📘</div>
          <h3>How to Use Rotahr</h3>
          <p>
            A full walkthrough guide with real product screenshots — dashboard, rota, clock,
            floor plan, bookkeeping, HACCP, recipes and payroll — so you can show prospects
            exactly what they're signing up for.
          </p>
          <div className="card-meta">PDF · 11 pages</div>
          <a href="/affiliate-resources/How-to-Use-Rotahr.pdf" download className="dl-btn">
            Download guide
          </a>
        </div>
      </div>

      <div className="tip">
        <p>
          Tip: attach both PDFs when you email a lead, or share the direct download links in a
          WhatsApp or LinkedIn message. Your unique referral link still does the tracking — these
          are just supporting material.
        </p>
      </div>

      <footer>
        <p>© {new Date().getFullYear()} Rotahr. All rights reserved.</p>
        <a href="/partners">Back to Partner Programme</a>
      </footer>
    </>
  );
}
