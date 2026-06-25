import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./_print-button";

const ALLERGEN_LABELS: Record<string, string> = {
  allergenGluten: "Gluten", allergenCrustacean: "Crustaceans", allergenEgg: "Eggs",
  allergenFish: "Fish", allergenPeanut: "Peanuts", allergenSoy: "Soybeans",
  allergenMilk: "Milk", allergenNuts: "Tree Nuts", allergenCelery: "Celery",
  allergenMustard: "Mustard", allergenSesame: "Sesame", allergenSulphites: "Sulphites",
  allergenLupin: "Lupin", allergenMollusc: "Molluscs",
};

const COURSE_LABELS: Record<string, string> = {
  starter: "Starters", soup: "Soup", main: "Main Course", dessert: "Desserts",
  cheese: "Cheese Course", tea_coffee: "Tea & Coffee", canapes: "Canapés & Nibbles",
  kids: "Kids Menu", buffet: "Buffet",
};

interface Dish {
  id: string; name: string; description?: string | null; notes?: string | null;
  isVegan: boolean; isVegetarian: boolean; isGlutenFree: boolean; isHalal: boolean; isKosher: boolean;
  [key: string]: unknown;
}

interface Course {
  id: string; courseType: string; label?: string | null; choiceCount: number;
  dishes: Dish[];
}

interface Menu {
  name: string; description?: string | null; pricePerHead?: number | null;
  minGuests?: number | null; maxGuests?: number | null;
  business: { name: string };
  courses: Course[];
}

function allergens(dish: Dish): string[] {
  return Object.keys(ALLERGEN_LABELS).filter((k) => dish[k] === true).map((k) => ALLERGEN_LABELS[k]);
}

function dietBadges(dish: Dish) {
  const badges = [];
  if (dish.isVegan) badges.push({ label: "Vegan", color: "#16a34a" });
  if (dish.isVegetarian && !dish.isVegan) badges.push({ label: "Vegetarian", color: "#65a30d" });
  if (dish.isGlutenFree) badges.push({ label: "GF", color: "#d97706" });
  if (dish.isHalal) badges.push({ label: "Halal", color: "#0891b2" });
  if (dish.isKosher) badges.push({ label: "Kosher", color: "#7c3aed" });
  return badges;
}

export default async function PublicMenuPage({ params }: { params: { token: string } }) {
  const menu = await prisma.functionMenu.findUnique({
    where: { shareToken: params.token },
    include: {
      business: { select: { name: true } },
      courses: {
        orderBy: { sortOrder: "asc" },
        include: { dishes: { orderBy: { sortOrder: "asc" } } },
      },
    },
  }) as Menu | null;

  if (!menu) notFound();

  return (
    <div className="min-h-screen bg-stone-50 font-serif">
      {/* Print button — hidden in print */}
      <div className="print:hidden fixed top-4 right-4 z-10">
        <PrintButton />
      </div>

      <div className="max-w-2xl mx-auto px-8 py-12 print:py-6 print:px-6">
        {/* Header */}
        <div className="text-center mb-10 border-b border-stone-300 pb-8">
          <p className="text-xs tracking-widest uppercase text-stone-500 mb-2">{menu.business.name}</p>
          <h1 className="text-4xl font-bold text-stone-800 mb-2">{menu.name}</h1>
          {menu.description && <p className="text-stone-500 text-sm mt-3 italic">{menu.description}</p>}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-stone-500">
            {menu.pricePerHead && <span>€{menu.pricePerHead.toFixed(2)} per person</span>}
            {(menu.minGuests || menu.maxGuests) && (
              <span>
                {menu.minGuests && menu.maxGuests
                  ? `${menu.minGuests}–${menu.maxGuests} guests`
                  : menu.minGuests
                  ? `Min ${menu.minGuests} guests`
                  : `Max ${menu.maxGuests} guests`}
              </span>
            )}
          </div>
        </div>

        {/* Courses */}
        <div className="space-y-10">
          {menu.courses.map((course) => {
            const hasDietary = course.dishes.some(
              (d) => d.isVegan || d.isVegetarian || d.isGlutenFree || d.isHalal || d.isKosher
            );
            const noDietaryWarning = !hasDietary && course.dishes.length > 0;

            return (
              <div key={course.id}>
                {/* Course heading */}
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-lg font-bold tracking-wide uppercase text-stone-700 border-b border-stone-200 pb-1 flex-1">
                    {course.label || COURSE_LABELS[course.courseType] || course.courseType}
                  </h2>
                  <span className="text-xs text-stone-400 ml-4 whitespace-nowrap">
                    Choose {course.choiceCount}
                  </span>
                </div>

                {noDietaryWarning && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                    ⚠ No dietary options marked for this course
                  </div>
                )}

                {course.dishes.length === 0 && (
                  <p className="text-stone-400 text-sm italic">No options added yet</p>
                )}

                <div className="space-y-5">
                  {course.dishes.map((dish) => {
                    const badges = dietBadges(dish);
                    const dishAllergens = allergens(dish);
                    return (
                      <div key={dish.id} className="flex gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className="font-semibold text-stone-800">{dish.name}</span>
                            {badges.map((b) => (
                              <span
                                key={b.label}
                                style={{ backgroundColor: b.color + "20", color: b.color, border: `1px solid ${b.color}40` }}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>
                          {dish.description && (
                            <p className="text-stone-500 text-sm mt-0.5 italic">{dish.description}</p>
                          )}
                          {dishAllergens.length > 0 && (
                            <p className="text-stone-400 text-xs mt-1">
                              <span className="font-medium text-stone-500">Contains:</span>{" "}
                              {dishAllergens.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-stone-200 text-center text-xs text-stone-400 space-y-1">
          <p>Please inform your server of any allergies or dietary requirements not listed above.</p>
          <p>All dishes are prepared in a kitchen that handles all 14 EU allergens.</p>
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
