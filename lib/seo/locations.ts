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
  {
    slug: "london",
    city: "London",
    county: "Greater London",
    country: "UK",
    intro:
      "London hospitality runs across 33 separate boroughs, each with its own environmental health team, on some of the highest rent and staff-turnover numbers in UK hospitality — margin is won or lost on labour cost, not covers.",
    localPoints: [
      "Food hygiene inspections are run borough by borough under the Food Hygiene Rating Scheme (FHRS), so the sticker in the window and the record behind it both need to be right for whichever council covers your postcode.",
      "The highest staff turnover of any UK hospitality market means a rota is rarely settled — per-head pricing punishes exactly that churn.",
      "Rent and National Living Wage increases have both moved sharply in recent years, which makes knowing real labour cost percentage week to week, not just at month end, the difference between a profitable shift and a losing one.",
      "A mix of tourist footfall in the West End and local trade in the boroughs means demand swings street by street, not just citywide.",
    ],
    areas: ["Soho", "Shoreditch", "Camden", "Clapham", "Borough Market"],
  },
  {
    slug: "manchester",
    city: "Manchester",
    county: "Greater Manchester",
    country: "UK",
    intro:
      "Manchester's independent food and drink scene — the Northern Quarter especially — has grown fast on a young, student-heavy workforce and a nightlife trade that runs late and changes week to week.",
    localPoints: [
      "A large student population from the University of Manchester and Manchester Metropolitan means availability resets every term — onboarding new staff onto a rota is a constant job, not a one-off.",
      "Late-licence, nightlife-driven trade makes break timing and end-of-shift records worth getting right under the Working Time Regulations.",
      "Manchester City Council runs food hygiene inspections under the national FHRS scheme — the same 0–5 rating used across England, so a clean paper trail for temperature and delivery checks matters at inspection.",
      "Christmas Markets and match-day surges around the city centre create short, severe demand spikes that need fast cover, not a week's notice.",
    ],
    areas: ["Northern Quarter", "Ancoats", "Deansgate", "Chorlton", "Spinningfields"],
  },
  {
    slug: "edinburgh",
    city: "Edinburgh",
    county: "City of Edinburgh",
    country: "UK",
    intro:
      "Edinburgh's trade is defined by August: the Fringe and the wider festival season bring the single sharpest demand spike of any UK city, on top of a trade that is otherwise steady and tourist-driven year-round.",
    localPoints: [
      "The Fringe alone brings on roughly 100 seasonal staff a year just for the festival organisations, and venues across the city hire similarly hard for August — a flat monthly price beats per-head pricing badly across that swing.",
      "Scotland runs its own food hygiene scheme, the Food Hygiene Information Scheme (FHIS) — a pass/improvement-required result rather than England's 0–5 FHRS score — run by the City of Edinburgh Council, so records need to be ready for a different inspection format.",
      "Scottish employment law tracks the UK-wide Working Time Regulations 1998, but statutory and public holiday patterns differ from both England and Ireland, so a rota built around the wrong calendar causes real pay errors.",
      "Old Town and New Town trade is dense and largely independent, with a short, brutal peak season and a much quieter winter.",
    ],
    areas: ["Old Town", "New Town", "Leith", "Grassmarket", "Stockbridge"],
  },
  {
    slug: "belfast",
    city: "Belfast",
    county: "Antrim",
    country: "UK",
    intro:
      "Belfast's food scene has grown quickly around the Cathedral Quarter and Titanic Quarter, trading on a mix of local regulars and a tourism trade built on the Titanic story and the Causeway Coastal route — and on employment rules that are genuinely distinct from the rest of the UK.",
    localPoints: [
      "Northern Ireland runs its own employment law rather than following Great Britain's directly — the Working Time Regulations (Northern Ireland) 2016 set a 20-minute break after six hours' continuous work and a 12-week averaging reference period, against 52 weeks in the rest of the UK, so a rota built on GB defaults can get entitlements wrong.",
      "Food hygiene inspections follow the FHRS scheme used in England and Wales, run locally by Belfast City Council — the same 0–5 rating, different council and different inspection calendar to London or Manchester.",
      "Titanic Quarter and city-centre tourism trade brings a strong summer peak on top of steady local trade, so staffing needs to flex without a full seasonal rebuild.",
      "A growing but still tight independent scene means the person building the rota is usually also running the floor.",
    ],
    areas: ["Cathedral Quarter", "Titanic Quarter", "Lisburn Road", "Stranmillis", "Ballyhackamore"],
  },
];

export function getLocation(slug: string) {
  return locations.find((l) => l.slug === slug);
}
