import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rotahr — Pitch Deck',
  description: 'One app to run your entire venue. Rotas, Clock-In, Reservations, Bookkeeping, Payroll — all in one place. Built for Irish hospitality.',
  openGraph: {
    title: 'Rotahr — One app to run your entire venue',
    description: 'See how Rotahr replaces 4–5 separate tools for Irish hospitality venues.',
    images: ['https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FCrgxhP2MJXbx87efI2p01%2Fslide-01.png'],
  },
  twitter: { card: 'summary_large_image' },
}

export default function PitchDeckPage() {
  const slides = [
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FCrgxhP2MJXbx87efI2p01%2Fslide-01.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FBgaYpiY3-JUa_oL959JSU%2Fslide-02.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FY7nH1pnU_UEgsiDhnHU6y%2Fslide-03.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FO8QcvCkPqGTbli5OUGjav%2Fslide-04.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2F7BwnCSbo1yMpXh_YB3seO%2Fslide-05.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FOAeIRaeDq68iQDNyiT47W%2Fslide-06.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FSCvBYkxNoqnStTm41BLLD%2Fslide-07.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FKG5c_vpNriWdRz4siNd87%2Fslide-08.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FMUQjxFaJENjFmrpa2qPQn%2Fslide-09.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FY_Zh5Un59mQ8AyE2lZPlG%2Fslide-10.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2Fpk4r7ZTaS1nlixQXG2miX%2Fslide-11.png",
    "https://storage.googleapis.com/runable-templates/cli-uploads%2FnpR7iwoxdmjjem91IBsyOE3SjrOrbdCS%2FOjziMdnxOaPCjHXhn_4hI%2Fslide-12.png",
  ]

  const slidesJson = JSON.stringify(slides)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .pitch-page {
          background: #0a0f1a;
          color: #fff;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .pitch-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky;
          top: 0;
          background: rgba(10,15,26,0.95);
          backdrop-filter: blur(12px);
          z-index: 100;
        }
        .pitch-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .pitch-logo-text { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
        .pitch-cta {
          background: #f97316;
          color: #fff;
          border: none;
          padding: 10px 22px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .pitch-cta:hover { opacity: 0.85; }
        .pitch-hero {
          text-align: center;
          padding: 64px 24px 40px;
        }
        .pitch-hero-label {
          display: inline-block;
          background: rgba(249,115,22,0.15);
          color: #f97316;
          border: 1px solid rgba(249,115,22,0.3);
          padding: 5px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .pitch-hero h1 {
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -1px;
          margin-bottom: 16px;
        }
        .pitch-hero h1 span { color: #f97316; }
        .pitch-hero p {
          font-size: 18px;
          color: rgba(255,255,255,0.55);
          max-width: 520px;
          margin: 0 auto 32px;
          line-height: 1.6;
        }
        .pitch-hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn-primary {
          background: #f97316;
          color: #fff;
          padding: 14px 28px;
          border-radius: 100px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: opacity 0.2s;
          border: none;
          cursor: pointer;
        }
        .btn-primary:hover { opacity: 0.85; }
        .btn-secondary {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.8);
          padding: 14px 28px;
          border-radius: 100px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.12);
          transition: background 0.2s;
          cursor: pointer;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.13); }
        .viewer-wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px 16px;
        }
        .main-slide-wrap {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          background: #000;
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
        }
        .main-slide {
          width: 100%;
          aspect-ratio: 16/9;
          display: block;
          transition: opacity 0.25s ease;
        }
        .nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          z-index: 10;
        }
        .nav-btn:hover { background: rgba(249,115,22,0.7); }
        .nav-prev { left: 16px; }
        .nav-next { right: 16px; }
        .slide-counter {
          position: absolute;
          bottom: 14px;
          right: 20px;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 100px;
        }
        .thumbnails {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 16px 0 4px;
          scrollbar-width: thin;
          scrollbar-color: #f97316 transparent;
        }
        .thumbnails::-webkit-scrollbar { height: 4px; }
        .thumbnails::-webkit-scrollbar-thumb { background: #f97316; border-radius: 2px; }
        .thumb {
          flex: 0 0 auto;
          width: 120px;
          aspect-ratio: 16/9;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid transparent;
          transition: border-color 0.2s, transform 0.15s, opacity 0.2s;
          opacity: 0.55;
        }
        .thumb:hover { opacity: 0.8; transform: scale(1.03); }
        .thumb.active { border-color: #f97316; opacity: 1; }
        .thumb img { width: 100%; height: 100%; display: block; object-fit: cover; }
        .progress-bar {
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
          margin: 8px 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #f97316;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .kbd-hint {
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          margin-top: 8px;
        }
        .pitch-stats {
          display: flex;
          justify-content: center;
          gap: 40px;
          flex-wrap: wrap;
          padding: 48px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          margin: 40px 0;
        }
        .stat { text-align: center; }
        .stat-num { font-size: 36px; font-weight: 800; color: #f97316; line-height: 1; }
        .stat-label { font-size: 13px; color: rgba(255,255,255,0.45); margin-top: 6px; }
        .bottom-cta {
          text-align: center;
          padding: 64px 24px 80px;
        }
        .bottom-cta h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px; }
        .bottom-cta h2 span { color: #f97316; }
        .bottom-cta p { color: rgba(255,255,255,0.5); font-size: 16px; margin-bottom: 32px; }
        .trust-badges {
          display: flex;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
          margin-top: 24px;
        }
        .badge { font-size: 12px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 6px; }
        .pitch-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 24px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pitch-footer p { font-size: 13px; color: rgba(255,255,255,0.3); }
        .pitch-footer a { color: rgba(255,255,255,0.4); text-decoration: none; }
        .pitch-footer a:hover { color: #f97316; }
        @media (max-width: 600px) {
          .pitch-header { padding: 16px 20px; }
          .pitch-stats { gap: 24px; }
          .pitch-footer { flex-direction: column; text-align: center; }
        }
      `}</style>

      <div className="pitch-page">
        <header className="pitch-header">
          <a className="pitch-logo" href="/landing">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="20" fill="#0f172a"/>
              <path d="M20 8C15 8 11 13 13 18C15 23 20 24 20 32C20 24 25 23 27 18C29 13 25 8 20 8Z" fill="url(#pg)"/>
              <defs>
                <linearGradient id="pg" x1="20" y1="8" x2="20" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f97316"/>
                  <stop offset="1" stopColor="#ec4899"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="pitch-logo-text">rotahr</span>
          </a>
          <a className="pitch-cta" href="/auth/signin">Start Free Trial</a>
        </header>

        <section className="pitch-hero">
          <div className="pitch-hero-label">Pitch Deck · 12 Slides</div>
          <h1>One app to run<br/><span>your entire venue</span></h1>
          <p>Rotas · Clock-In · Reservations · Bookkeeping · Payroll — built for Irish hospitality.</p>
          <div className="pitch-hero-actions">
            <a className="btn-primary" href="/auth/signin">Start Free Trial</a>
            <button className="btn-secondary" onClick={() => document.getElementById('viewer')?.scrollIntoView({behavior:'smooth'})}>
              View Deck ↓
            </button>
          </div>
        </section>

        <div className="viewer-wrap" id="viewer">
          <div className="main-slide-wrap">
            <img className="main-slide" id="pitchMainSlide" src={slides[0]} alt="Slide 1" />
            <button className="nav-btn nav-prev" id="pitchPrev">&#8592;</button>
            <button className="nav-btn nav-next" id="pitchNext">&#8594;</button>
            <div className="slide-counter"><span id="pitchCurSlide">1</span> / 12</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" id="pitchProgress" style={{width: '8.33%'}}></div>
          </div>
          <p className="kbd-hint">Use ← → arrow keys to navigate</p>
          <div className="thumbnails" id="pitchThumbs">
            {slides.map((src, i) => (
              <div key={i} className={`thumb${i === 0 ? ' active' : ''}`} data-index={i}>
                <img src={src} alt={`Slide ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
        </div>

        <div className="pitch-stats">
          <div className="stat"><div className="stat-num">€290</div><div className="stat-label">avg. monthly saving vs. separate tools</div></div>
          <div className="stat"><div className="stat-num">4.8 hrs</div><div className="stat-label">saved per manager per week</div></div>
          <div className="stat"><div className="stat-num">12</div><div className="stat-label">tools replaced by one platform</div></div>
          <div className="stat"><div className="stat-num">€79</div><div className="stat-label">starting price incl. 23% VAT</div></div>
        </div>

        <section className="bottom-cta">
          <h2>Ready to simplify<br/><span>your venue?</span></h2>
          <p>First month free. No credit card required. Cancel anytime.</p>
          <a className="btn-primary" href="/auth/signin" style={{fontSize:'16px',padding:'16px 36px'}}>Get Started Free — rotahr.com</a>
          <div className="trust-badges">
            <span className="badge">🔒 GDPR Compliant</span>
            <span className="badge">☘️ Built for Ireland</span>
            <span className="badge">✓ No Setup Fees</span>
            <span className="badge">📱 iOS & Android</span>
          </div>
        </section>

        <footer className="pitch-footer">
          <p>© 2025 Rotahr. Built for Irish hospitality.</p>
          <div style={{display:'flex',gap:'20px'}}>
            <a href="/landing">rotahr.com</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </footer>
      </div>

      <script dangerouslySetInnerHTML={{__html: `
        (function() {
          var slides = ${slidesJson};
          var current = 0;
          var mainSlide = document.getElementById('pitchMainSlide');
          var curSlideEl = document.getElementById('pitchCurSlide');
          var progressFill = document.getElementById('pitchProgress');
          var thumbsEl = document.getElementById('pitchThumbs');

          function goTo(n) {
            current = Math.max(0, Math.min(slides.length - 1, n));
            mainSlide.style.opacity = '0';
            setTimeout(function() {
              mainSlide.src = slides[current];
              mainSlide.style.opacity = '1';
            }, 150);
            curSlideEl.textContent = current + 1;
            progressFill.style.width = ((current + 1) / slides.length * 100) + '%';
            var thumbs = thumbsEl.querySelectorAll('.thumb');
            thumbs.forEach(function(t, i) { t.classList.toggle('active', i === current); });
            thumbs[current].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }

          document.getElementById('pitchPrev').addEventListener('click', function() { goTo(current - 1); });
          document.getElementById('pitchNext').addEventListener('click', function() { goTo(current + 1); });

          thumbsEl.querySelectorAll('.thumb').forEach(function(t) {
            t.addEventListener('click', function() { goTo(parseInt(t.dataset.index)); });
          });

          document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1);
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current - 1);
          });
        })();
      `}} />
    </>
  )
}
