import Link from "next/link";
import { Briefcase, Smartphone, Share, Plus, MoreVertical, Globe, ArrowRight, CheckCircle } from "lucide-react";

export const metadata = {
  title: "Install Rotahr App",
  description: "Add Rotahr to your home screen for the best experience.",
};

export default function InstallPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50">
        <Link href="/" className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-blue-400" />
          <span className="text-xl font-bold text-white">Rotahr</span>
        </Link>
        <Link
          href="/auth/signin"
          className="text-sm text-blue-400 hover:text-blue-300 font-medium"
        >
          Sign in →
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mx-auto mb-6 shadow-lg shadow-blue-600/30">
            <Smartphone className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Get the Rotahr App</h1>
          <p className="text-slate-400 text-lg">
            Add Rotahr to your home screen — works like a real app, no App Store needed.
          </p>
        </div>

        {/* What you get */}
        <div className="grid grid-cols-2 gap-3 mb-12">
          {[
            "View your shifts & rota",
            "Clock in & out",
            "Request time off",
            "Message your team",
            "Get instant notifications",
            "Check bookings",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
              <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-slate-300 text-sm">{item}</span>
            </div>
          ))}
        </div>

        {/* iPhone Instructions */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-700 rounded-xl">
              {/* Apple logo SVG */}
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">iPhone / iPad</h2>
              <p className="text-slate-400 text-sm">Using Safari browser</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                step: "1",
                icon: <Globe className="h-5 w-5 text-blue-400" />,
                title: "Open Safari",
                desc: 'Go to rotahr.com in Safari (must be Safari — not Chrome or Firefox)',
              },
              {
                step: "2",
                icon: <Share className="h-5 w-5 text-blue-400" />,
                title: 'Tap the Share button',
                desc: 'Tap the Share icon at the bottom of the screen (box with arrow pointing up)',
              },
              {
                step: "3",
                icon: <Plus className="h-5 w-5 text-blue-400" />,
                title: '"Add to Home Screen"',
                desc: 'Scroll down in the share menu and tap "Add to Home Screen"',
              },
              {
                step: "4",
                icon: <CheckCircle className="h-5 w-5 text-green-400" />,
                title: "Tap Add",
                desc: 'Tap "Add" in the top right — Rotahr will appear on your home screen',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-full flex-shrink-0 text-blue-400 font-bold text-sm">
                  {item.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.icon}
                    <p className="text-white font-medium">{item.title}</p>
                  </div>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Android Instructions */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-700 rounded-xl">
              {/* Android logo SVG */}
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.341a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-9.046 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM2.95 8.341h18.1v8.5a2 2 0 0 1-2 2H4.95a2 2 0 0 1-2-2v-8.5zm1.5-1.5L6.2 3.2a.5.5 0 0 1 .866.5L5.6 5.841h12.8l-1.466-2.141a.5.5 0 0 1 .866-.5l1.75 2.641H21.05v1.5H2.95v-1.5H4.45z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Android</h2>
              <p className="text-slate-400 text-sm">Using Chrome browser</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                step: "1",
                icon: <Globe className="h-5 w-5 text-blue-400" />,
                title: "Open Chrome",
                desc: "Go to rotahr.com in Chrome on your Android phone",
              },
              {
                step: "2",
                icon: <MoreVertical className="h-5 w-5 text-blue-400" />,
                title: "Tap the three dots menu",
                desc: "Tap ⋮ in the top right corner of Chrome",
              },
              {
                step: "3",
                icon: <Plus className="h-5 w-5 text-blue-400" />,
                title: '"Add to Home screen"',
                desc: 'Tap "Add to Home screen" from the menu',
              },
              {
                step: "4",
                icon: <CheckCircle className="h-5 w-5 text-green-400" />,
                title: "Tap Add",
                desc: "Confirm — Rotahr will appear on your home screen like any other app",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-full flex-shrink-0 text-blue-400 font-bold text-sm">
                  {item.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {item.icon}
                    <p className="text-white font-medium">{item.title}</p>
                  </div>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Sign in to Rotahr <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-slate-500 text-sm">
            Don't have an account yet? Ask your manager to invite you.
          </p>
        </div>
      </div>
    </div>
  );
}
