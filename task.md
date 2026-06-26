# Rotahr Gap Fixes — All 4 Competitive Gaps

## Gaps to fix:
1. **HR depth** — onboarding checklist + document storage per employee (vs Rotaready)
2. **Rota UX polish** — drag-and-drop shift grid (vs Deputy)
3. **Supplier statement reconciliation** — match received invoices against supplier orders (vs Opsyte)
4. **AI demand/labour forecasting** — predict required staffing from booking data (vs Fourth/Rotaready)

---

## Gap 1: HR Depth — Employee Onboarding + Document Storage

### DB additions (prisma):
- `EmployeeDocument` model: id, employeeId, businessId, title, category (CONTRACT | ID | CERT | HANDBOOK | OTHER), fileUrl, fileName, uploadedAt
- `OnboardingTask` model: id, employeeId, businessId, title, completed, dueDate?, completedAt?
- Pre-seed standard tasks: "Sign contract", "Upload ID", "Complete HACCP training", "Read staff handbook", "Set up bank details"

### API routes:
- `GET/POST /api/hr/documents?employeeId=` — list & upload docs
- `DELETE /api/hr/documents/[id]` — delete doc
- `GET/POST /api/hr/onboarding?employeeId=` — list & create tasks
- `PATCH /api/hr/onboarding/[id]` — toggle complete

### UI:
- New tab "HR" on `/employees/[id]/page.tsx` — split into:
  - **Onboarding** tab: checklist with progress bar, tick off tasks, due dates
  - **Documents** tab: upload (Vercel Blob), list with download links, delete
- Summary badge on employee list card: "Onboarding X/5"
- Managers see all; staff sees their own documents

---

## Gap 2: Rota UX — Drag-and-Drop Shift Grid

### Approach:
- Use `@dnd-kit/core` + `@dnd-kit/sortable` (already lightweight, no extra deps needed)
- Desktop rota grid: each shift chip becomes draggable, each empty cell is a drop target
- Drag shift → new cell = PATCH shift with new employeeId + date
- Visual: shift chip shows ghost during drag, target cell highlights blue on hover
- Mobile unchanged (tap-to-edit stays, dnd is desktop-only)

### Files:
- `/app/(app)/rota/page.tsx` — add dnd-kit context, make shift chips draggable, cells droppable
- Install: `bun add @dnd-kit/core @dnd-kit/utilities`

---

## Gap 3: Supplier Statement Reconciliation

### What it does:
- Upload a supplier invoice/statement PDF or image
- AI reads line items: item, qty, unit price, total
- Compare against open `SupplierOrder` for that supplier
- Show matched / unmatched / price variance lines
- One-click "Accept & mark received" to close the order

### DB additions:
- `SupplierStatement` model: id, businessId, supplierId, fileUrl, uploadedAt, status (pending|matched|discrepancy), aiExtracted (Json), matchedOrderId?

### API routes:
- `POST /api/suppliers/statements` — upload, trigger AI extraction
- `GET /api/suppliers/statements?supplierId=` — list
- `POST /api/suppliers/statements/[id]/reconcile` — accept match, mark order received

### UI:
- New tab "Statements" in `/app/(app)/stock/page.tsx`
- Upload button per supplier → AI reads → reconciliation view
- Shows: line-by-line match table, ✓ matched / ⚠ variance / ✗ not in order
- "Accept all" button → marks SupplierOrder as received, updates lastPrice on StockItems

---

## Gap 4: AI Labour/Demand Forecasting

### What it does:
- Looks at reservations for next 7 days (by day + time slot)
- Calculates expected covers/pax per shift slot
- Compares against current rota headcount
- Suggests: "Friday dinner service: 45 covers expected, only 3 staff rostered — suggest 5"
- Shows historical: actual covers vs staff scheduled (last 4 weeks)

### API routes:
- `GET /api/ai/labour-forecast?weekStart=YYYY-MM-DD` — returns forecast per day

### AI logic (`lib/ai/labour-forecast.ts`):
- Pull reservations for the week
- Group by day + meal service (lunch = 12-15, dinner = 18-22)
- Calculate pax load (sum of partySize)
- Benchmark: 1 floor staff per 12 covers, 1 kitchen per 15 covers (configurable in AISettings)
- Compare vs rostered staff
- Return array of suggestions

### UI:
- New card on `/app/(app)/rota/page.tsx` — "AI Staffing Forecast" panel
- Shows next 7 days: expected covers, staff needed vs rostered, colour-coded status
- Link to AI settings to adjust covers-per-staff ratio

---

## Order of execution:
1. Gap 4 (AI forecast) — API + rota UI panel — no new DB models
2. Gap 3 (Supplier reconciliation) — schema + API + stock UI tab
3. Gap 1 (HR docs + onboarding) — schema + API + employee profile tabs
4. Gap 2 (Drag-and-drop rota) — dnd-kit install + rota page refactor
