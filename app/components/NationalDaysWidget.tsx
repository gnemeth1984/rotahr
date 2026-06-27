"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartyPopper, ChefHat, Bell } from "lucide-react";

interface Holiday {
  name: string;
  url: string;
  isFoodDrink?: boolean;
}

interface UpcomingHoliday extends Holiday {
  daysAhead: number;
  label: string;
}

function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("pancake") || n.includes("waffle")) return "🥞";
  if (n.includes("donut") || n.includes("doughnut")) return "🍩";
  if (n.includes("cake") || n.includes("cupcake") || n.includes("muffin")) return "🎂";
  if (n.includes("pie") || n.includes("tart") || n.includes("pastry") || n.includes("croissant")) return "🥐";
  if (n.includes("cookie") || n.includes("brownie") || n.includes("biscuit")) return "🍪";
  if (n.includes("chocolate") || n.includes("cocoa") || n.includes("cacao") || n.includes("fudge")) return "🍫";
  if (n.includes("candy") || n.includes("sweet") || n.includes("toffee") || n.includes("caramel") || n.includes("licorice") || n.includes("liquorice")) return "🍬";
  if (n.includes("ice cream") || n.includes("gelato") || n.includes("sorbet")) return "🍦";
  if (n.includes("pudding") || n.includes("custard")) return "🍮";
  if (n.includes("pizza")) return "🍕";
  if (n.includes("taco") || n.includes("burrito") || n.includes("nacho") || n.includes("tortilla")) return "🌮";
  if (n.includes("burger") || n.includes("hotdog") || n.includes("hot dog")) return "🍔";
  if (n.includes("sushi") || n.includes("sashimi")) return "🍣";
  if (n.includes("ramen") || n.includes("noodle") || n.includes("pasta")) return "🍜";
  if (n.includes("steak") || n.includes("beef") || n.includes("bbq") || n.includes("barbecue") || n.includes("grill")) return "🥩";
  if (n.includes("bacon") || n.includes("ham") || n.includes("sausage") || n.includes("pork")) return "🥓";
  if (n.includes("chicken") || n.includes("turkey")) return "🍗";
  if (n.includes("fish") || n.includes("salmon") || n.includes("tuna") || n.includes("seafood")) return "🐟";
  if (n.includes("shrimp") || n.includes("prawn") || n.includes("lobster") || n.includes("crab")) return "🦞";
  if (n.includes("cheese")) return "🧀";
  if (n.includes("egg") || n.includes("omelette")) return "🍳";
  if (n.includes("bread") || n.includes("bagel") || n.includes("toast")) return "🍞";
  if (n.includes("sandwich")) return "🥪";
  if (n.includes("soup") || n.includes("stew") || n.includes("chili") || n.includes("curry")) return "🍲";
  if (n.includes("salad") || n.includes("avocado")) return "🥗";
  if (n.includes("potato") || n.includes("fries") || n.includes("chips")) return "🍟";
  if (n.includes("onion")) return "🧅";
  if (n.includes("mushroom")) return "🍄";
  if (n.includes("corn")) return "🌽";
  if (n.includes("strawberry")) return "🍓";
  if (n.includes("cherry")) return "🍒";
  if (n.includes("peach") || n.includes("mango")) return "🥭";
  if (n.includes("pineapple")) return "🍍";
  if (n.includes("watermelon")) return "🍉";
  if (n.includes("apple")) return "🍎";
  if (n.includes("banana")) return "🍌";
  if (n.includes("lemon") || n.includes("lime")) return "🍋";
  if (n.includes("orange")) return "🍊";
  if (n.includes("grape") || n.includes("blueberry") || n.includes("raspberry")) return "🍇";
  if (n.includes("coconut")) return "🥥";
  if (n.includes("peanut") || n.includes("almond") || n.includes("walnut") || n.includes("pistachio") || n.includes("cashew")) return "🥜";
  if (n.includes("honey") || n.includes("maple")) return "🍯";
  if (n.includes("beer") || n.includes("brew") || n.includes("ale") || n.includes("lager") || n.includes("cider") || n.includes("bartender") || n.includes("mixologist")) return "🍺";
  if (n.includes("wine") || n.includes("champagne") || n.includes("prosecco")) return "🍷";
  if (n.includes("cocktail") || n.includes("mocktail") || n.includes("spirits") || n.includes("whiskey") || n.includes("whisky") || n.includes("bourbon") || n.includes("gin") || n.includes("vodka") || n.includes("rum") || n.includes("tequila")) return "🍸";
  if (n.includes("coffee") || n.includes("espresso") || n.includes("cappuccino") || n.includes("latte")) return "☕";
  if (n.includes("tea") || n.includes("boba")) return "🍵";
  if (n.includes("juice") || n.includes("lemonade") || n.includes("smoothie")) return "🥤";
  if (n.includes("milkshake") || n.includes("hot chocolate")) return "🥛";
  if (n.includes("popcorn")) return "🍿";
  if (n.includes("pretzel")) return "🥨";
  if (n.includes("tofu") || n.includes("vegan") || n.includes("vegetarian")) return "🌱";
  if (n.includes("bbq") || n.includes("barbecue") || n.includes("smoke") || n.includes("grill")) return "🔥";
  if (n.includes("chef") || n.includes("cook") || n.includes("kitchen") || n.includes("restaurant") || n.includes("dining") || n.includes("recipe")) return "👨‍🍳";
  if (n.includes("food") || n.includes("eat") || n.includes("feast") || n.includes("meal")) return "🍽️";
  // non-food fallbacks
  if (n.includes("dog") || n.includes("puppy")) return "🐶";
  if (n.includes("cat") || n.includes("kitten")) return "🐱";
  if (n.includes("music") || n.includes("song") || n.includes("jazz")) return "🎵";
  if (n.includes("book") || n.includes("read") || n.includes("librar")) return "📚";
  if (n.includes("run") || n.includes("walk") || n.includes("hike") || n.includes("marathon")) return "🏃";
  if (n.includes("sun") || n.includes("summer") || n.includes("beach") || n.includes("picnic") || n.includes("camp")) return "☀️";
  if (n.includes("birthday") || n.includes("anniversar") || n.includes("celebrat")) return "🎂";
  if (n.includes("love") || n.includes("heart") || n.includes("marriage") || n.includes("married") || n.includes("wedding")) return "❤️";
  if (n.includes("sunglass")) return "😎";
  if (n.includes("smurf")) return "🔵";
  if (n.includes("worker") || n.includes("labor") || n.includes("labour")) return "⚒️";
  return "🎉";
}

export default function NationalDaysWidget() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/national-days")
      .then((r) => r.json())
      .then((d) => {
        setHolidays(d.holidays ?? []);
        setUpcoming(d.upcoming ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      {/* Upcoming food/drink alert — shown only when there's something */}
      {!loading && upcoming.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              🍽️ Food &amp; Drink Days Coming Up — Plan Your Specials!
            </span>
          </div>
          <ul className="space-y-1.5">
            {upcoming.map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                  {h.label}
                </span>
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-900 hover:text-amber-700 hover:underline underline-offset-2 flex items-center gap-1.5"
                >
                  <span>{getEmoji(h.name)}</span>
                  <span>{h.name}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-amber-500 mt-2">
            💡 Post a special on the Menu Specials board to match the day
          </p>
        </div>
      )}

      {/* Today's national days */}
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
                    className={`flex items-center gap-2 text-sm transition-colors group ${
                      h.isFoodDrink
                        ? "text-orange-700 font-medium hover:text-orange-500"
                        : "text-slate-700 hover:text-violet-600"
                    }`}
                  >
                    <span className="text-base leading-none">{getEmoji(h.name)}</span>
                    <span className="group-hover:underline underline-offset-2">{h.name}</span>
                    {h.isFoodDrink && (
                      <ChefHat className="h-3.5 w-3.5 text-orange-400 shrink-0 ml-auto" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-slate-300 mt-3">via checkiday.com</p>
        </CardContent>
      </Card>
    </div>
  );
}
