/**
 * Location landing pages.
 *
 * These target "rota software <city>" style queries, which have far lower
 * competition than the national head terms and much higher intent.
 *
 * IMPORTANT: these are only worth having if each page says something genuinely
 * specific to the place. Spinning up 40 near-identical pages with the city name
 * swapped is doorway-page behaviour, which Google explicitly penalises. Every
 * entry below therefore carries real local detail, and we deliberately keep the
 * list short rather than padding it out.
 */

export interface Location {
  slug: string;
  city: string;
  county: string;
  country: "Ireland" | "UK";
  /** Genuine local context — trade patterns, not filler. */
  intro: string;
  /** Specific local pressures a venue there actually feels. */
  localPoints: string[];
  /** Recognisable trade areas, to make the page concretely about the place. */
  areas: string[];
}

export const locations: Location[] = [
  {
    slug: "dublin",
    city: "Dublin",
    county: "Dublin",
    country: "Ireland",
    intro:
      "Dublin venues run on split shifts and a young, mobile workforce. Staff turnover is the highest in the country, which means onboarding happens constantly and a rota is never settled for long.",
    localPoints: [
      "High staff churn means you're adding and removing people from the rota most weeks — per-user pricing punishes exactly that.",
      "Tourist-season swings between the quays, Temple Bar and the suburbs are severe, so last-minute cover is normal rather than exceptional.",
      "Late licences and split shifts make break entitlement under the Organisation of Working Time Act easy to get wrong.",
      "Environmental Health Officer inspections across Dublin City Council are frequent — paper temperature diaries are the usual weak point.",
    ],
    areas: ["Temple Bar", "Rathmines", "Dún Laoghaire", "Smithfield", "Ranelagh"],
  },
  {
    slug: "cork",
    city: "Cork",
    county: "Cork",
    country: "Ireland",
    intro:
      "Cork's independent food scene is dense and fiercely local — a lot of owner-operated kitchens where the chef is also the one doing the paperwork at midnight.",
    localPoints: [
      "Owner-operated venues means whoever writes the rota is also cooking — time spent on admin comes straight out of service.",
      "The English Market and city-centre trade brings heavy supplier delivery volume, so delivery records and stock pricing move constantly.",
      "Strong seasonal swing around festivals and match days needs fast rota changes staff actually see.",
      "Cork City Council EHO inspections expect legible, dated food safety records on request.",
    ],
    areas: ["English Market", "Oliver Plunkett Street", "Douglas", "Ballincollig", "Kinsale"],
  },
  {
    slug: "galway",
    city: "Galway",
    county: "Galway",
    country: "Ireland",
    intro:
      "Galway is as seasonal as it gets in Ireland. Race Week and the festival calendar can double covers, then it drops away — staffing has to flex hard in both directions.",
    localPoints: [
      "Race Week and festival season mean short-term staff who need onboarding onto a rota in hours, not days.",
      "Student workforce from the university brings availability that changes every term.",
      "Extreme peak-to-trough demand makes labour cost percentage worth watching weekly rather than monthly.",
      "A high proportion of small independents where one person handles rota, orders and books.",
    ],
    areas: ["Shop Street", "Salthill", "Latin Quarter", "Oranmore", "Clifden"],
  },
  {
    slug: "limerick",
    city: "Limerick",
    county: "Limerick",
    country: "Ireland",
    intro:
      "Limerick's trade is steadier than the tourist cities but tighter on margin — which puts the pressure on wage cost and waste rather than on peak-season chaos.",
    localPoints: [
      "Steadier year-round trade makes overtime creep the main labour cost problem rather than seasonal spikes.",
      "Match days at Thomond Park create predictable but severe one-day surges worth planning staffing around.",
      "Tighter margins mean knowing real dish cost when supplier prices move actually matters.",
      "Smaller teams where one manager covers rota, stock and compliance.",
    ],
    areas: ["Bedford Row", "Catherine Street", "Castletroy", "Adare", "Annacotty"],
  },
  {
    slug: "kerry",
    city: "Kerry",
    county: "Kerry",
    country: "Ireland",
    intro:
      "Kerry is the sharpest seasonal market in Ireland. Killarney and the Ring of Kerry run flat out through summer and go quiet in winter, so the entire staffing model changes twice a year.",
    localPoints: [
      "Genuinely seasonal headcount — a venue can go from 6 staff to 20 and back within a year, so a flat monthly price beats per-user by a wide margin.",
      "Heavy reliance on seasonal and returning staff who need re-onboarding each spring.",
      "Tourist-driven booking volume where no-shows hurt disproportionately in a short season.",
      "Rural venues with patchy signal need a rota staff can check on their phone and have it actually load.",
    ],
    areas: ["Killarney", "Tralee", "Dingle", "Kenmare", "Castleisland"],
  },
  {
    slug: "waterford",
    city: "Waterford",
    county: "Waterford",
    country: "Ireland",
    intro:
      "Waterford's Viking Triangle and greenway trade has grown steadily, bringing a mix of established pubs and newer independent kitchens with lean teams.",
    localPoints: [
      "Greenway and day-tripper trade makes weekday demand unusually weather-dependent.",
      "A mix of long-established pubs and new independents, so systems range from paper diaries to nothing at all.",
      "Small teams where the owner is on the floor and admin happens after close.",
      "Waterford City & County Council inspections expect the same records as anywhere — usually the paper gap.",
    ],
    areas: ["Viking Triangle", "John Roberts Square", "Tramore", "Dungarvan", "Ardkeen"],
  },
];

export function getLocation(slug: string) {
  return locations.find((l) => l.slug === slug);
}
