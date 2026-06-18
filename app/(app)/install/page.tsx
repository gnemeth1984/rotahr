import { Smartphone, Share, Plus, MoreVertical, Globe, CheckCircle } from "lucide-react";

export const metadata = {
  title: "Get the App | Rotahr",
  description: "Add Rotahr to your home screen for the best experience.",
};

export default function InstallPage() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mx-auto mb-4 shadow-lg">
          <Smartphone className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Get the Rotahr App</h1>
        <p className="text-slate-500">
          Add Rotahr to your home screen — works like a real app, no App Store needed.
        </p>
      </div>

      {/* What you get */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          "View your shifts & rota",
          "Clock in & out",
          "Request time off",
          "Message your team",
          "Get instant notifications",
          "Check bookings",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-slate-700 text-sm">{item}</span>
          </div>
        ))}
      </div>

      {/* iPhone */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
            <svg className="h-5 w-5 text-slate-800" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-slate-900 font-semibold">iPhone / iPad</h2>
            <p className="text-slate-400 text-sm">Must use Safari</p>
          </div>
        </div>
        <div className="space-y-4">
          {[
            { step: "1", icon: <Globe className="h-4 w-4 text-blue-500" />, title: "Open Safari", desc: "Go to rotahr.com in Safari — must be Safari, not Chrome or Firefox" },
            { step: "2", icon: <Share className="h-4 w-4 text-blue-500" />, title: "Tap the Share button", desc: "Tap the Share icon at the bottom (box with arrow pointing up)" },
            { step: "3", icon: <Plus className="h-4 w-4 text-blue-500" />, title: 'Tap "Add to Home Screen"', desc: "Scroll down in the share menu and tap it" },
            { step: "4", icon: <CheckCircle className="h-4 w-4 text-green-500" />, title: "Tap Add", desc: 'Tap "Add" in the top right — Rotahr appears on your home screen' },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="flex items-center justify-center w-7 h-7 bg-blue-50 border border-blue-200 rounded-full flex-shrink-0 text-blue-600 font-bold text-xs">
                {item.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  {item.icon}
                  <p className="text-slate-800 font-medium text-sm">{item.title}</p>
                </div>
                <p className="text-slate-500 text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Android */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl">
            <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.341a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-9.046 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM2.95 8.341h18.1v8.5a2 2 0 0 1-2 2H4.95a2 2 0 0 1-2-2v-8.5zm1.5-1.5L6.2 3.2a.5.5 0 0 1 .866.5L5.6 5.841h12.8l-1.466-2.141a.5.5 0 0 1 .866-.5l1.75 2.641H21.05v1.5H2.95v-1.5H4.45z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-slate-900 font-semibold">Android</h2>
            <p className="text-slate-400 text-sm">Using Chrome browser</p>
          </div>
        </div>
        <div className="space-y-4">
          {[
            { step: "1", icon: <Globe className="h-4 w-4 text-blue-500" />, title: "Open Chrome", desc: "Go to rotahr.com in Chrome on your Android phone" },
            { step: "2", icon: <MoreVertical className="h-4 w-4 text-blue-500" />, title: "Tap the three dots ⋮", desc: "Tap ⋮ in the top right corner of Chrome" },
            { step: "3", icon: <Plus className="h-4 w-4 text-blue-500" />, title: 'Tap "Add to Home screen"', desc: "Select it from the menu" },
            { step: "4", icon: <CheckCircle className="h-4 w-4 text-green-500" />, title: "Tap Add", desc: "Rotahr will appear on your home screen like any other app" },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="flex items-center justify-center w-7 h-7 bg-blue-50 border border-blue-200 rounded-full flex-shrink-0 text-blue-600 font-bold text-xs">
                {item.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  {item.icon}
                  <p className="text-slate-800 font-medium text-sm">{item.title}</p>
                </div>
                <p className="text-slate-500 text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
