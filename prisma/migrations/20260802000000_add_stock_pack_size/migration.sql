-- Pack size for stock items.
-- `lastPrice` is the price of one purchase unit as invoiced (a 5kg box, a 50L keg).
-- packSize + packUnit record what is actually inside it, so recipe costing can
-- divide instead of multiplying the pack price by the recipe quantity.
-- Left NULL for existing rows on purpose: guessing a pack size would produce
-- confidently wrong food costs. Recipes that need one are flagged in the UI.
ALTER TABLE "StockItem" ADD COLUMN "packSize" DOUBLE PRECISION;
ALTER TABLE "StockItem" ADD COLUMN "packUnit" TEXT;
