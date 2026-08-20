import type { TemplateCategory } from "./types";

/** Display order of the hub page. Most-searched paperwork first. */
export const templateCategories: TemplateCategory[] = [
  {
    id: "haccp",
    name: "HACCP & food safety",
    blurb:
      "Temperature logs, delivery checks and corrective action records — the paperwork an inspector asks for first.",
  },
  {
    id: "rota",
    name: "Rotas & scheduling",
    blurb:
      "Weekly rota grids, swap requests and holiday forms for teams still working off paper or a group chat.",
  },
  {
    id: "open-close",
    name: "Opening & closing",
    blurb:
      "Section-by-section checklists so the first and last hour of the day run the same whoever is on.",
  },
  {
    id: "safety",
    name: "Health & safety",
    blurb:
      "First aid steps, fire safety checks and accident reporting — printable and ready to go on the wall.",
  },
  {
    id: "cleaning",
    name: "Cleaning schedules",
    blurb:
      "Daily, weekly and deep clean schedules with sign-off columns, split by area.",
  },
  {
    id: "hr",
    name: "Staff & HR",
    blurb:
      "Induction, training records and probation reviews to get new starters productive and documented.",
  },
  {
    id: "stock",
    name: "Stock & ordering",
    blurb:
      "Stock counts, wastage logs and par-level order sheets to stop guessing what to order.",
  },
  {
    id: "bar",
    name: "Bar & cellar",
    blurb:
      "Line cleaning records, cellar checks and spirit stocktakes for wet-led sites.",
  },
  {
    id: "hotel",
    name: "Hotel & rooms",
    blurb:
      "Housekeeping room checklists and guest incident logs for rooms-side operations.",
  },
  {
    id: "finance",
    name: "Finance & tips",
    blurb:
      "Daily takings, cash reconciliation and a transparent tips distribution sheet.",
  },
];

export function getCategory(id: string) {
  return templateCategories.find((c) => c.id === id);
}
