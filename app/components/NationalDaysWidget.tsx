"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartyPopper } from "lucide-react";

interface Holiday {
  name: string;
  url: string;
}

// Fun emoji map — matches keywords in holiday names
function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("pancake") || n.includes("waffle") || n.includes("donut") || n.includes("doughnut") || n.includes("cake") || n.includes("pie") || n.includes("cookie") || n.includes("brownie") || n.includes("chocolate") || n.includes("candy") || n.includes("ice cream") || n.includes("pudding")) return "🍰";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("taco") || n.includes("burrito")) return "🌮";
  if (n.includes("burger") || n.includes("hotdog") || n.includes("hot dog")) return "🍔";
  if (n.includes("beer") || n.includes("brew") || n.includes("bartender") || n.includes("mixologist")) return "🍺";
  if (n.includes("wine") || n.includes("champagne")) return "🍷";
  if (n.includes("coffee") || n.includes("espresso") || n.includes("cappuccino")) return "☕";
  if (n.includes("tea")) return "🍵";
  if (n.includes("dog") || n.includes("puppy")) return "🐶";
  if (n.includes("cat") || n.includes("kitten")) return "🐱";
  if (n.includes("bird") || n.includes("eagle") || n.includes("owl")) return "🐦";
  if (n.includes("fish") || n.includes("salmon") || n.includes("tuna")) return "🐟";
  if (n.includes("horse")) return "🐴";
  if (n.includes("bee") || n.includes("honey")) return "🐝";
  if (n.includes("music") || n.includes("song") || n.includes("sing") || n.includes("jazz") || n.includes("rock")) return "🎵";
  if (n.includes("book") || n.includes("read") || n.includes("librar") || n.includes("poem") || n.includes("poet")) return "📚";
  if (n.includes("sport") || n.includes("soccer") || n.includes("football") || n.includes("rugby") || n.includes("golf")) return "⚽";
  if (n.includes("run") || n.includes("walk") || n.includes("hike") || n.includes("marathon")) return "🏃";
  if (n.includes("yoga") || n.includes("meditat") || n.includes("wellness") || n.includes("health")) return "🧘";
  if (n.includes("earth") || n.includes("environment") || n.includes("tree") || n.includes("forest") || n.includes("green")) return "🌍";
  if (n.includes("sun") || n.includes("summer") || n.includes("beach") || n.includes("picnic") || n.includes("campout") || n.includes("camp")) return "☀️";
  if (n.includes("rain") || n.includes("storm")) return "🌧️";
  if (n.includes("snow") || n.includes("winter") || n.includes("christmas") || n.includes("xmas")) return "❄️";
  if (n.includes("birthday") || n.includes("anniversar") || n.includes("celebrat")) return "🎂";
  if (n.includes("friend") || n.includes("friendship")) return "🤝";
  if (n.includes("love") || n.includes("heart") || n.includes("valentine") || n.includes("marriage") || n.includes("married") || n.includes("wedding")) return "❤️";
  if (n.includes("parent") || n.includes("mother") || n.includes("father") || n.includes("dad") || n.includes("mom") || n.includes("family")) return "👨‍👩‍👧";
  if (n.includes("child") || n.includes("kid") || n.includes("baby")) return "👶";
  if (n.includes("teacher") || n.includes("education") || n.includes("school") || n.includes("student")) return "🎓";
  if (n.includes("doctor") || n.includes("nurse") || n.includes("health") || n.includes("mental")) return "🏥";
  if (n.includes("art") || n.includes("paint") || n.includes("mural") || n.includes("draw") || n.includes("craft")) return "🎨";
  if (n.includes("photo") || n.includes("camera")) return "📷";
  if (n.includes("film") || n.includes("movie") || n.includes("cinema")) return "🎬";
  if (n.includes("game") || n.includes("chess") || n.includes("bingo") || n.includes("card")) return "🎮";
  if (n.includes("science") || n.includes("technology") || n.includes("engineer")) return "🔬";
  if (n.includes("space") || n.includes("astronaut") || n.includes("moon") || n.includes("star")) return "🚀";
  if (n.includes("ocean") || n.includes("sea") || n.includes("coral") || n.includes("shark") || n.includes("whale")) return "🌊";
  if (n.includes("flower") || n.includes("rose") || n.includes("tulip") || n.includes("blossom")) return "🌸";
  if (n.includes("sunglass")) return "😎";
  if (n.includes("smurf")) return "🔵";
  if (n.includes("ragweed") || n.includes("allerg")) return "🤧";
  if (n.includes("worker") || n.includes("labor") || n.includes("labour")) return "⚒️";
  if (n.includes("volunteer") || n.includes("charity") || n.includes("humanitarian")) return "🤲";
  if (n.includes("flag") || n.includes("national") || n.includes("independence") || n.includes("freedom")) return "🏳️";
  if (n.includes("veteran") || n.includes("military") || n.includes("army") || n.includes("navy")) return "🎖️";
  if (n.includes("peace")) return "☮️";
  if (n.includes("women") || n.includes("girl") || n.includes("female")) return "👩";
  if (n.includes("men") || n.includes("man") || n.includes("male") || n.includes("boy")) return "👨";
  return "🎉";
}

export default function NationalDaysWidget() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/national-days")
      .then((r) => r.json())
      .then((d) => setHolidays(d.holidays ?? []))
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="border bg-gradient-to-br from-violet-50 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PartyPopper className="h-4 w-4 text-violet-500" />
          Today&apos;s National Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : holidays.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">Nothing special today — make your own!</p>
        ) : (
          <ul className="space-y-1.5">
            {holidays.map((h, i) => (
              <li key={i}>
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-700 hover:text-violet-600 transition-colors group"
                >
                  <span className="text-base leading-none">{getEmoji(h.name)}</span>
                  <span className="group-hover:underline underline-offset-2">{h.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-slate-300 mt-3">via checkiday.com</p>
      </CardContent>
    </Card>
  );
}
