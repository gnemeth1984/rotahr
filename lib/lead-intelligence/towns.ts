/**
 * Target towns. Job-board searches rotate through these by UTC day; the free FHRS importer
 * rotates through the UK towns that use the 0-5 FHRS scheme (England, Wales, Northern Ireland).
 * Scottish towns use FHIS (Pass / Improvement Required) and are searched for jobs only.
 */
export type IeTown = { name: string; county: string };
export type UkTown = { name: string; nation: "england" | "wales" | "ni" | "scotland"; fhrsAuthorities: { id: number; name: string }[] };

// User list, plus every Republic of Ireland county town and the existing cities.
export const IE_TOWNS: IeTown[] = [
  { name: "Dublin", county: "Dublin" }, { name: "Cork", county: "Cork" }, { name: "Galway", county: "Galway" },
  { name: "Limerick", county: "Limerick" }, { name: "Waterford", county: "Waterford" }, { name: "Killarney", county: "Kerry" },
  { name: "Tralee", county: "Kerry" }, { name: "Ennis", county: "Clare" }, { name: "Athlone", county: "Westmeath" },
  { name: "Sligo", county: "Sligo" }, { name: "Letterkenny", county: "Donegal" }, { name: "Mullingar", county: "Westmeath" },
  { name: "Portlaoise", county: "Laois" }, { name: "Kilkenny", county: "Kilkenny" }, { name: "Clonmel", county: "Tipperary" },
  { name: "Wexford", county: "Wexford" }, { name: "Dundalk", county: "Louth" }, { name: "Navan", county: "Meath" },
  { name: "Drogheda", county: "Louth" }, { name: "Castlebar", county: "Mayo" }, { name: "Cavan", county: "Cavan" },
  { name: "Tullamore", county: "Offaly" }, { name: "Carlow", county: "Carlow" }, { name: "Naas", county: "Kildare" },
  { name: "Nenagh", county: "Tipperary" }, { name: "Lifford", county: "Donegal" }, { name: "Carrick-on-Shannon", county: "Leitrim" },
  { name: "Longford", county: "Longford" }, { name: "Monaghan", county: "Monaghan" }, { name: "Roscommon", county: "Roscommon" },
  { name: "Wicklow", county: "Wicklow" }, { name: "Listowel", county: "Kerry" },
];

const one = (id: number, name: string) => [{ id, name }];
// FHRS LocalAuthorityId values verified against https://api.ratings.food.gov.uk/Authorities/basic (2026-11-04).
export const UK_TOWNS: UkTown[] = [
  { name: "London", nation: "england", fhrsAuthorities: [
    { id: 120, name: "Westminster" }, { id: 93, name: "Camden" }, { id: 99, name: "Hackney" }, { id: 115, name: "Southwark" },
    { id: 106, name: "Islington" }, { id: 109, name: "Lambeth" }, { id: 117, name: "Tower Hamlets" },
    { id: 107, name: "Kensington and Chelsea" }, { id: 95, name: "City of London Corporation" }] },
  { name: "Manchester", nation: "england", fhrsAuthorities: one(180, "Manchester") },
  { name: "Birmingham", nation: "england", fhrsAuthorities: one(374, "Birmingham") },
  { name: "Liverpool", nation: "england", fhrsAuthorities: one(179, "Liverpool") },
  { name: "Leeds", nation: "england", fhrsAuthorities: one(397, "Leeds") },
  { name: "Bristol", nation: "england", fhrsAuthorities: one(324, "Bristol") },
  { name: "Belfast", nation: "ni", fhrsAuthorities: one(138, "Belfast City") },
  { name: "Cardiff", nation: "wales", fhrsAuthorities: one(339, "Cardiff") },
  { name: "Edinburgh", nation: "scotland", fhrsAuthorities: [] },
  { name: "Glasgow", nation: "scotland", fhrsAuthorities: [] },
  { name: "Sheffield", nation: "england", fhrsAuthorities: one(399, "Sheffield") },
  { name: "Newcastle upon Tyne", nation: "england", fhrsAuthorities: one(122, "Newcastle Upon Tyne") },
  { name: "Nottingham", nation: "england", fhrsAuthorities: one(87, "Nottingham City") },
  { name: "Leicester", nation: "england", fhrsAuthorities: one(85, "Leicester City") },
  { name: "Brighton", nation: "england", fhrsAuthorities: one(286, "Brighton and Hove") },
  { name: "Swansea", nation: "wales", fhrsAuthorities: one(351, "Swansea") },
  { name: "Derry", nation: "ni", fhrsAuthorities: one(144, "Derry City and Strabane") },
  { name: "Newry", nation: "ni", fhrsAuthorities: one(145, "Newry, Mourne and Down") },
  { name: "Lisburn", nation: "ni", fhrsAuthorities: one(140, "Lisburn and Castlereagh City") },
  { name: "Coventry", nation: "england", fhrsAuthorities: one(375, "Coventry") },
  { name: "Bradford", nation: "england", fhrsAuthorities: one(393, "Bradford") },
  { name: "Salford", nation: "england", fhrsAuthorities: one(184, "Salford") },
  { name: "York", nation: "england", fhrsAuthorities: one(406, "York") },
  { name: "Bath", nation: "england", fhrsAuthorities: one(326, "Bath and North East Somerset") },
  { name: "Oxford", nation: "england", fhrsAuthorities: one(262, "Oxford City") },
  { name: "Cambridge", nation: "england", fhrsAuthorities: one(1, "Cambridge City") },
  { name: "Norwich", nation: "england", fhrsAuthorities: one(33, "Norwich City") },
  { name: "Exeter", nation: "england", fhrsAuthorities: one(297, "Exeter City") },
  { name: "Plymouth", nation: "england", fhrsAuthorities: one(331, "Plymouth City") },
  { name: "Southampton", nation: "england", fhrsAuthorities: one(288, "Southampton") },
  { name: "Portsmouth", nation: "england", fhrsAuthorities: one(287, "Portsmouth") },
  { name: "Reading", nation: "england", fhrsAuthorities: one(291, "Reading") },
  { name: "Milton Keynes", nation: "england", fhrsAuthorities: one(285, "Milton Keynes") },
  { name: "Derby", nation: "england", fhrsAuthorities: one(84, "Derby City") },
  { name: "Newport", nation: "wales", fhrsAuthorities: one(347, "Newport") },
  { name: "Chester", nation: "england", fhrsAuthorities: one(192, "Cheshire West and Chester") },
  { name: "Bournemouth", nation: "england", fhrsAuthorities: one(328, "Bournemouth, Christchurch and Poole") },
  { name: "Canterbury", nation: "england", fhrsAuthorities: one(250, "Canterbury City") },
  { name: "Cheltenham", nation: "england", fhrsAuthorities: one(310, "Cheltenham") },
  { name: "Stoke-on-Trent", nation: "england", fhrsAuthorities: one(382, "Stoke-On-Trent") },
  { name: "Wolverhampton", nation: "england", fhrsAuthorities: one(380, "Wolverhampton") },
  { name: "Aberdeen", nation: "scotland", fhrsAuthorities: [] },
];

/** FHRS rotation units: one (town, authority) pair each. */
export const FHRS_UNITS = UK_TOWNS.flatMap(t => t.fhrsAuthorities.map(a => ({ town: t.name, authorityId: a.id, authority: a.name })));
export const countyForIeTown = (town: string) => IE_TOWNS.find(t => t.name.toLowerCase() === town.trim().toLowerCase())?.county ?? null;
