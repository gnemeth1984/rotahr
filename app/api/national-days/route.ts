import { NextResponse } from "next/server";

export const revalidate = 3600;

const FOOD_DRINK_KEYWORDS = [
  // drinks
  "beer","brew","ale","lager","cider","bartender","mixologist","cocktail","mocktail",
  "wine","champagne","prosecco","spirits","whiskey","whisky","bourbon","gin","vodka",
  "rum","tequila","coffee","espresso","cappuccino","latte","tea","boba","juice",
  "lemonade","smoothie","milkshake","hot chocolate","cacao","cocoa",
  // food broad
  "food","eat","eating","feast","cuisine","recipe","cook","cooking","bake","baking",
  "chef","kitchen","restaurant","dining","dish","meal","lunch","dinner","brunch","breakfast",
  "snack","dessert","sweet","candy","chocolate","sugar","caramel","fudge","toffee",
  // specific foods
  "pancake","waffle","donut","doughnut","cake","cupcake","muffin","pie","tart","pastry",
  "croissant","bread","bagel","toast","sandwich","burger","hotdog","hot dog","taco",
  "burrito","nacho","tortilla","pizza","pasta","noodle","ramen","sushi","sashimi",
  "steak","beef","chicken","pork","bacon","ham","sausage","lamb","turkey","seafood",
  "fish","salmon","tuna","shrimp","prawn","lobster","crab","oyster","clam","squid",
  "cheese","butter","cream","milk","yogurt","egg","omelette","frittata","quiche",
  "soup","stew","chili","curry","rice","potato","fries","chips","salad","avocado",
  "hummus","guacamole","salsa","sauce","gravy","mustard","ketchup","mayo",
  "ice cream","gelato","sorbet","pudding","brownie","cookie","biscuit","cracker",
  "pretzel","popcorn","peanut","almond","walnut","pistachio","cashew",
  "apple","banana","strawberry","cherry","peach","mango","pineapple","watermelon",
  "lemon","lime","orange","grape","blueberry","raspberry","blackberry","coconut",
  "onion","garlic","tomato","pepper","mushroom","spinach","broccoli","carrot",
  "corn","pea","bean","lentil","tofu","vegan","vegetarian","gluten",
  "bbq","barbecue","grill","smoke","jerky","charcuterie",
  "honey","maple","jam","jelly","marmalade","peanut butter",
  "toffee","caramel","fudge","liquorice","licorice",
];

function isFoodOrDrink(name: string): boolean {
  const n = name.toLowerCase();
  return FOOD_DRINK_KEYWORDS.some((kw) => n.includes(kw));
}

async function fetchDay(date: Date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const dateStr = `${mm}/${dd}/${yyyy}`;

  const res = await fetch(`https://www.checkiday.com/api/3/?d=${dateStr}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  if (json.error !== "none") return [];
  return (json.holidays ?? []).map((h: { name: string; url: string }) => ({
    name: h.name,
    url: h.url,
    isFoodDrink: isFoodOrDrink(h.name),
  }));
}

export async function GET() {
  try {
    const today = new Date();
    const day1 = new Date(today); day1.setDate(today.getDate() + 1);
    const day2 = new Date(today); day2.setDate(today.getDate() + 2);

    const [todayHols, day1Hols, day2Hols] = await Promise.all([
      fetchDay(today),
      fetchDay(day1),
      fetchDay(day2),
    ]);

    // Today: top 6 all
    const holidays = todayHols.slice(0, 6);

    // Upcoming food/drink only (next 2 days)
    const upcoming: { name: string; url: string; isFoodDrink: boolean; daysAhead: number; label: string }[] = [];

    day1Hols.filter((h: { isFoodDrink: boolean }) => h.isFoodDrink).forEach((h: { name: string; url: string; isFoodDrink: boolean }) => {
      upcoming.push({ ...h, daysAhead: 1, label: "Tomorrow" });
    });
    day2Hols.filter((h: { isFoodDrink: boolean }) => h.isFoodDrink).forEach((h: { name: string; url: string; isFoodDrink: boolean }) => {
      upcoming.push({ ...h, daysAhead: 2, label: "In 2 days" });
    });

    return NextResponse.json({ holidays, upcoming });
  } catch (e) {
    console.error("National days API error:", e);
    return NextResponse.json({ holidays: [], upcoming: [] });
  }
}
