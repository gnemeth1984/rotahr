const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const g = await p.asset.groupBy({ by: ["businessId"], _count: { _all: true } });
  console.log("assets per business:", JSON.stringify(g, null, 2));
  for (const b of ["demo-anchor-tap-biz", "demo-owner-pro-biz", "admin-test-biz"]) {
    const rows = await p.asset.findMany({ where: { businessId: b }, select: { name: true, category: true, location: true, status: true, nextServiceDate: true } });
    console.log(b, rows.length, JSON.stringify(rows));
    const eq = await p.hACCPEquipment.count({ where: { businessId: b } });
    console.log(b, "haccp equipment:", eq);
  }
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
