/**
 * Allergen reference data.
 *
 * The 14 keys below match the EU/UK named list, and the field names match the
 * Boolean columns on Dish and FunctionMenuDish so the two can be read
 * interchangeably.
 *
 * IMPORTANT — audience is international, and this data drives training material
 * that staff are asked to sign. Do NOT write a country-specific legal claim into
 * any string here. The named list itself differs by jurisdiction:
 *
 *   EU / UK / Ireland   14 named allergens (this list)
 *   United States       9 major allergens — no celery, mustard, sesame is in,
 *                       lupin/mollusc/sulphites are not "major" but sulphites
 *                       still carry a declaration threshold
 *   Australia / NZ      similar to the EU list, plus separate lupin rules
 *
 * Where a threshold matters (sulphites) it is stated as a widely used figure and
 * the operator is told to check their own rules. A wrong compliance claim on a
 * training certificate is worse than no training at all.
 */

export const ALLERGEN_KEYS = [
  "gluten",
  "crustacean",
  "egg",
  "fish",
  "peanut",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "mollusc",
] as const;

export type AllergenKey = (typeof ALLERGEN_KEYS)[number];

export interface Allergen {
  key: AllergenKey;
  /** Boolean column on Dish / FunctionMenuDish. */
  field: string;
  /** How it is written on a menu. */
  label: string;
  /** Plain-English scope note. */
  scope: string;
  /**
   * Where it hides. These are the items staff get wrong, and they are the whole
   * reason a generic "there are 14 allergens" course changes nothing.
   */
  hides: string[];
}

export const ALLERGENS: Allergen[] = [
  {
    key: "gluten",
    field: "allergenGluten",
    label: "Cereals containing gluten",
    scope: "Wheat, rye, barley, oats, spelt and khorasan, and anything made from them.",
    hides: [
      "Soy sauce — most standard soy sauce is brewed with wheat",
      "Stock cubes, gravy granules and bouillon",
      "Sausages, burgers and stuffing used as a binder",
      "Chips dusted with flour before freezing",
      "Roux, velouté and any flour-thickened sauce",
      "Battered and crumbed items sharing a fryer with anything else",
    ],
  },
  {
    key: "crustacean",
    field: "allergenCrustacean",
    label: "Crustaceans",
    scope: "Prawn, shrimp, crab, lobster, langoustine, crayfish.",
    hides: [
      "Shellfish stock or bisque used as a base for a non-shellfish dish",
      "XO sauce and many South East Asian pastes",
      "Prawn crackers cooked in a shared fryer",
      "Seafood dressings and cocktail sauces",
    ],
  },
  {
    key: "egg",
    field: "allergenEgg",
    label: "Eggs",
    scope: "Hen and other birds' eggs, including dried and pasteurised egg.",
    hides: [
      "Mayonnaise, aioli, hollandaise and Caesar dressing",
      "Egg wash glaze on pastry and bread",
      "Fresh pasta and many gnocchi recipes",
      "Meringue, mousse, custard and some ice creams",
      "Clarified consommé and some batters",
    ],
  },
  {
    key: "fish",
    field: "allergenFish",
    label: "Fish",
    scope: "All finned fish, including dried, smoked and fermented fish products.",
    hides: [
      "Worcestershire sauce — contains anchovy",
      "Caesar dressing and many olive tapenades",
      "Fish sauce in Thai and Vietnamese dishes, including some curries",
      "Some kimchi and XO sauce",
      "Gelatine and fining agents in a few drinks",
    ],
  },
  {
    key: "peanut",
    field: "allergenPeanut",
    label: "Peanuts",
    scope: "A legume, not a tree nut. Declared separately for that reason.",
    hides: [
      "Satay and many marinades",
      "Groundnut (peanut) oil — including in shared fryers",
      "Cheaper curry pastes and chilli sauces as a thickener",
      "Some biscuits, ice creams and bar snacks",
    ],
  },
  {
    key: "soy",
    field: "allergenSoy",
    label: "Soybeans",
    scope: "Soybeans and products made from them.",
    hides: [
      "Soy sauce, teriyaki, hoisin and most Asian condiments",
      "Tofu, edamame, miso and tempeh",
      "Bread improvers and some commercial pastry",
      "Blended vegetable oils and some margarine",
    ],
  },
  {
    key: "milk",
    field: "allergenMilk",
    label: "Milk",
    scope: "Cow, goat and sheep milk, and anything derived from them including lactose.",
    hides: [
      "Butter finishing a sauce or mash described as vegetable",
      "Ghee, and pastry brushed with butter",
      "Pesto and many pasta sauces — hard cheese",
      "Some sorbets, and lactose in crisps and seasoning powders",
      "Milk-wash on bread and some batters",
    ],
  },
  {
    key: "nuts",
    field: "allergenNuts",
    label: "Tree nuts",
    scope:
      "Almond, hazelnut, walnut, cashew, pecan, Brazil, pistachio and macadamia. Note that pine nut and coconut are not on the named list, which is a common source of confusion.",
    hides: [
      "Pesto — usually pine nut, but often cashew or almond in commercial versions",
      "Marzipan, praline, frangipane and nut brittle",
      "Nut oils used to finish a dish",
      "Some breads, granola, dukkah and baklava",
      "Vegan cheese and cream alternatives — frequently cashew",
    ],
  },
  {
    key: "celery",
    field: "allergenCelery",
    label: "Celery",
    scope: "Stalks, leaves, seeds and celeriac.",
    hides: [
      "Stock cubes, bouillon and almost every mirepoix base",
      "Celery salt — including on a Bloody Mary rim",
      "Soups, ragù and braising liquids",
      "Some spice blends and cured meats",
    ],
  },
  {
    key: "mustard",
    field: "allergenMustard",
    label: "Mustard",
    scope: "Seeds, powder, prepared mustard and mustard oil.",
    hides: [
      "Mayonnaise and most vinaigrettes as an emulsifier",
      "Curry powder and many spice rubs",
      "Piccalilli, chutney and burger relish",
      "Marinades and some sausages",
    ],
  },
  {
    key: "sesame",
    field: "allergenSesame",
    label: "Sesame",
    scope: "Seeds, sesame oil and tahini.",
    hides: [
      "Hummus and baba ganoush — tahini",
      "Burger buns and many artisan breads",
      "Halva, dukkah and za'atar",
      "Toasted sesame oil finishing an Asian dish",
    ],
  },
  {
    key: "sulphites",
    field: "allergenSulphites",
    label: "Sulphur dioxide and sulphites",
    scope:
      "Commonly declared above 10 mg/kg or 10 mg/litre expressed as SO₂ — check the threshold and wording that applies where you trade.",
    hides: [
      "Wine, beer, cider and many soft drinks",
      "Dried fruit and glacé cherries",
      "Dehydrated and pre-prepared potato products",
      "Some sausages, burgers and prepared shellfish",
      "Vinegars and bottled lemon juice",
    ],
  },
  {
    key: "lupin",
    field: "allergenLupin",
    label: "Lupin",
    scope: "Lupin seeds and flour.",
    hides: [
      "Some gluten-free flour blends and baking mixes",
      "Imported pastries, breads and pasta",
      "A few vegan protein products",
    ],
  },
  {
    key: "mollusc",
    field: "allergenMollusc",
    label: "Molluscs",
    scope: "Mussel, oyster, clam, scallop, squid, octopus, snail.",
    hides: [
      "Oyster sauce in stir-fries and marinades",
      "Some fish stocks and seafood bases",
      "Laksa, XO and other fermented pastes",
      "Surimi and mixed seafood blends",
    ],
  },
];

const BY_KEY = new Map<AllergenKey, Allergen>(ALLERGENS.map((a) => [a.key, a]));
const BY_FIELD = new Map<string, Allergen>(ALLERGENS.map((a) => [a.field, a]));

export function allergen(key: AllergenKey): Allergen | undefined {
  return BY_KEY.get(key);
}

export function allergenByField(field: string): Allergen | undefined {
  return BY_FIELD.get(field);
}

export function allergenLabel(key: string): string {
  return BY_KEY.get(key as AllergenKey)?.label ?? key;
}

/** Shape of the allergen columns as they come back from Prisma. */
export type AllergenFlags = Partial<Record<string, boolean | null>>;

/** The keys a dish row is flagged as CONTAINING. */
export function containedKeys(row: AllergenFlags): AllergenKey[] {
  return ALLERGENS.filter((a) => row[a.field] === true).map((a) => a.key);
}

/** Parse the comma-separated traces column into known keys. */
export function parseTraces(traces: string | null | undefined): AllergenKey[] {
  if (!traces) return [];
  const wanted = new Set(
    traces
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return ALLERGEN_KEYS.filter((k) => wanted.has(k));
}

export function serialiseTraces(keys: string[]): string | null {
  const clean = ALLERGEN_KEYS.filter((k) => keys.includes(k));
  return clean.length ? clean.join(",") : null;
}
