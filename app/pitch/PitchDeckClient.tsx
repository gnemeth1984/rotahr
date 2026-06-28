'use client'

import { useState, useEffect, useRef } from 'react'

const SLIDES = [
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

export default function PitchDeckClient() {
  const [current, setCurrent] = useState(0)
  const [fading, setFading] = useState(false)
  const [displaySrc, setDisplaySrc] = useState(SLIDES[0])
  const thumbsRef = useRef<HTMLDivElement>(null)

  function goTo(n: number) {
    const next = Math.max(0, Math.min(SLIDES.length - 1, n))
    if (next === current) return
    setFading(true)
    setTimeout(() => {
      setCurrent(next)
      setDisplaySrc(SLIDES[next])
      setFading(false)
    }, 150)
  }

  useEffect(() => {
    // scroll active thumb into view
    if (thumbsRef.current) {
      const active = thumbsRef.current.children[current] as HTMLElement
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [current])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(current + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current])

  const progress = ((current + 1) / SLIDES.length) * 100

  return (
    <div style={{background:'#0a0f1a', color:'#fff', minHeight:'100vh', fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}}>
      <style>{`
        .pitch-thumb { flex:0 0 auto; width:120px; aspect-ratio:16/9; border-radius:6px; overflow:hidden; cursor:pointer; border:2px solid transparent; transition:border-color 0.2s, transform 0.15s, opacity 0.2s; opacity:0.55; }
        .pitch-thumb:hover { opacity:0.8; transform:scale(1.03); }
        .pitch-thumb.active { border-color:#f97316; opacity:1; }
        .pitch-thumb img { width:100%; height:100%; display:block; object-fit:cover; }
        .pitch-nav-btn { position:absolute; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.15); color:#fff; width:44px; height:44px; border-radius:50%; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; z-index:10; }
        .pitch-nav-btn:hover { background:rgba(249,115,22,0.7); }
        .pitch-badge { font-size:12px; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:6px; }
        @media (max-width:600px) {
          .pitch-header-inner { padding:16px 20px !important; }
          .pitch-stats { gap:24px !important; }
          .pitch-footer-inner { flex-direction:column; text-align:center; }
        }
      `}</style>

      {/* Header */}
      <header className="pitch-header-inner" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 40px',borderBottom:'1px solid rgba(255,255,255,0.08)',position:'sticky',top:0,background:'rgba(10,15,26,0.95)',backdropFilter:'blur(12px)',zIndex:100}}>
        <a href="/landing" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
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
          <span style={{fontSize:20,fontWeight:700,color:'#fff',letterSpacing:'-0.3px'}}>rotahr</span>
        </a>
        <a href="/auth/register" style={{background:'#f97316',color:'#fff',border:'none',padding:'10px 22px',borderRadius:'100px',fontSize:14,fontWeight:600,cursor:'pointer',textDecoration:'none'}}>
          Get Started
        </a>
      </header>

      {/* Hero */}
      <section style={{textAlign:'center',padding:'64px 24px 40px'}}>
        <div style={{display:'inline-block',background:'rgba(249,115,22,0.15)',color:'#f97316',border:'1px solid rgba(249,115,22,0.3)',padding:'5px 14px',borderRadius:'100px',fontSize:12,fontWeight:600,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:20}}>
          Pitch Deck · 12 Slides
        </div>
        <h1 style={{fontSize:'clamp(32px,5vw,56px)',fontWeight:800,lineHeight:1.1,letterSpacing:'-1px',marginBottom:16}}>
          One app to run<br/><span style={{color:'#f97316'}}>your entire venue</span>
        </h1>
        <p style={{fontSize:18,color:'rgba(255,255,255,0.55)',maxWidth:520,margin:'0 auto 32px',lineHeight:1.6}}>
          Rotas · Clock-In · Reservations · Bookkeeping · Payroll — built for Irish hospitality.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <a href="/auth/register" style={{background:'#f97316',color:'#fff',padding:'14px 28px',borderRadius:'100px',fontSize:15,fontWeight:600,textDecoration:'none'}}>
            Get Started
          </a>
          <button onClick={() => document.getElementById('pitch-viewer')?.scrollIntoView({behavior:'smooth'})}
            style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',padding:'14px 28px',borderRadius:'100px',fontSize:15,fontWeight:600,border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer'}}>
            View Deck ↓
          </button>
        </div>
      </section>

      {/* Slide Viewer */}
      <div id="pitch-viewer" style={{maxWidth:1100,margin:'0 auto',padding:'0 24px 16px'}}>
        <div style={{position:'relative',borderRadius:16,overflow:'hidden',background:'#000',boxShadow:'0 32px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.06)'}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt={`Slide ${current + 1}`}
            style={{width:'100%',aspectRatio:'16/9',display:'block',transition:'opacity 0.25s ease',opacity:fading ? 0 : 1}}
          />
          <button className="pitch-nav-btn" style={{left:16}} onClick={() => goTo(current - 1)}>&#8592;</button>
          <button className="pitch-nav-btn" style={{right:16}} onClick={() => goTo(current + 1)}>&#8594;</button>
          <div style={{position:'absolute',bottom:14,right:20,background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.7)',fontSize:12,fontWeight:600,padding:'4px 12px',borderRadius:'100px'}}>
            {current + 1} / {SLIDES.length}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{height:3,background:'rgba(255,255,255,0.08)',borderRadius:2,margin:'8px 0',overflow:'hidden'}}>
          <div style={{height:'100%',background:'#f97316',borderRadius:2,transition:'width 0.3s ease',width:`${progress}%`}}/>
        </div>

        <p style={{textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.25)',marginTop:8}}>Use ← → arrow keys to navigate</p>

        {/* Thumbnails */}
        <div ref={thumbsRef} style={{display:'flex',gap:8,overflowX:'auto',padding:'16px 0 4px',scrollbarWidth:'thin',scrollbarColor:'#f97316 transparent'}}>
          {SLIDES.map((src, i) => (
            <div key={i} className={`pitch-thumb${i === current ? ' active' : ''}`} onClick={() => goTo(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Slide ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="pitch-stats" style={{display:'flex',justifyContent:'center',gap:40,flexWrap:'wrap',padding:'48px 24px',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)',margin:'40px 0'}}>
        {[
          {num:'€290', label:'avg. monthly saving vs. separate tools'},
          {num:'4.8 hrs', label:'saved per manager per week'},
          {num:'12', label:'tools replaced by one platform'},
          {num:'€59', label:'starting price incl. 23% VAT'},
        ].map(s => (
          <div key={s.num} style={{textAlign:'center'}}>
            <div style={{fontSize:36,fontWeight:800,color:'#f97316',lineHeight:1}}>{s.num}</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginTop:6}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <section style={{textAlign:'center',padding:'64px 24px 80px'}}>
        <h2 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:800,marginBottom:12,letterSpacing:'-0.5px'}}>
          Ready to simplify<br/><span style={{color:'#f97316'}}>your venue?</span>
        </h2>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:16,marginBottom:32}}>First month free. No credit card required. Cancel anytime.</p>
        <a href="/auth/register" style={{background:'#f97316',color:'#fff',padding:'16px 36px',borderRadius:'100px',fontSize:16,fontWeight:600,textDecoration:'none'}}>
          Get Started Free — rotahr.com
        </a>
        <div style={{display:'flex',justifyContent:'center',gap:24,flexWrap:'wrap',marginTop:24}}>
          {['🔒 GDPR Compliant','☘️ Built for Ireland','✓ No Setup Fees','📱 iOS & Android'].map(b => (
            <span key={b} className="pitch-badge">{b}</span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="pitch-footer-inner" style={{borderTop:'1px solid rgba(255,255,255,0.06)',padding:'24px 40px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <p style={{fontSize:13,color:'rgba(255,255,255,0.3)'}}>© 2025 Rotahr. Built for Irish hospitality.</p>
        <div style={{display:'flex',gap:20}}>
          {[['rotahr.com','/landing'],['Privacy','/privacy'],['Terms','/terms']].map(([label, href]) => (
            <a key={href} href={href} style={{color:'rgba(255,255,255,0.4)',textDecoration:'none'}}>{label}</a>
          ))}
        </div>
      </footer>
    </div>
  )
}
