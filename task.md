# Menu Planning Feature

## Tabs inside Menu & Specials page
1. **Specials** (existing tab — current page content)
2. **Menu Planner** (weekly grid Mon-Sun × Breakfast/Lunch/Dinner)
3. **Dish Library** (CRUD dishes: name, category, sell price, cost price, margin)
4. **Recipe Cards** (ingredients from stock items → food cost %)
5. **Templates** (save week as template, copy to week)

## DB Models needed
- `Dish` — id, businessId, name, category, sellPrice, costPrice, description, imageUrl
- `DishIngredient` — id, dishId, stockItemId, qty, unit
- `MenuTemplate` — id, businessId, name, weekData (JSON)
- `WeeklyMenuPlan` — id, businessId, weekStart (Date), planData (JSON {mon:{breakfast:[dishId],...},...})

## Permissions
- ADMIN / MANAGER: full access always
- Employee with permission "menu_planning" can edit
- All staff: read-only view

## AI suggestions
- GET /api/menu/ai-suggestions → reads overstock items → GPT → returns dish ideas

## APIs needed
- /api/menu/dishes — CRUD
- /api/menu/dishes/[id]/ingredients — CRUD
- /api/menu/plans — GET/POST weekly plan
- /api/menu/templates — CRUD
- /api/menu/ai-suggestions — AI overstock suggestions

## Steps
1. Add Prisma models + migrate
2. Build API routes
3. Build page with tabs
4. Wire AI suggestions
