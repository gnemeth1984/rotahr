// @ts-nocheck
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 12);

  // Create Christy's Bar business
  const business = await prisma.business.upsert({
    where: { id: "christys-bar-seed-id" },
    update: { name: "Christy's Bar" },
    create: { id: "christys-bar-seed-id", name: "Christy's Bar" },
  });

  // Create Christy as MANAGER
  const christy = await prisma.user.upsert({
    where: { email: "christywalsh@gmail.com" },
    update: {
      name: "Christy",
      role: "MANAGER",
      password,
      businessId: business.id,
    },
    create: {
      name: "Christy",
      email: "christywalsh@gmail.com",
      role: "MANAGER",
      password,
      businessId: business.id,
    },
  });

  // Create some departments
  const bar = await prisma.department.upsert({
    where: { id: "dept-bar" },
    update: {},
    create: { id: "dept-bar", name: "Bar", businessId: business.id },
  });

  const kitchen = await prisma.department.upsert({
    where: { id: "dept-kitchen" },
    update: {},
    create: { id: "dept-kitchen", name: "Kitchen", businessId: business.id },
  });

  const floor = await prisma.department.upsert({
    where: { id: "dept-floor" },
    update: {},
    create: { id: "dept-floor", name: "Floor", businessId: business.id },
  });

  // Seed tables for Christy's Bar
  const tablesData = [
    { id: "table-1", name: "Table 1", capacity: 2, location: "Window" },
    { id: "table-2", name: "Table 2", capacity: 2, location: "Window" },
    { id: "table-3", name: "Table 3", capacity: 4, location: "Main Floor" },
    { id: "table-4", name: "Table 4", capacity: 4, location: "Main Floor" },
    { id: "table-5", name: "Table 5", capacity: 4, location: "Main Floor" },
    { id: "table-6", name: "Table 6", capacity: 6, location: "Main Floor" },
    { id: "table-7", name: "Table 7", capacity: 6, location: "Back Room" },
    { id: "table-8", name: "Table 8", capacity: 8, location: "Back Room" },
    { id: "table-9", name: "Table 9", capacity: 10, location: "Back Room" },
    {
      id: "table-private",
      name: "Private Dining Room",
      capacity: 20,
      location: "Private Room",
    },
  ];

  for (const t of tablesData) {
    await prisma.table.upsert({
      where: { id: t.id },
      update: { name: t.name, capacity: t.capacity, location: t.location },
      create: { ...t, businessId: business.id },
    });
  }

  console.log(`✅ Business: ${business.name} (${business.id})`);
  console.log(
    `✅ Manager: ${christy.name} <${christy.email}> (${christy.role})`
  );
  console.log(`✅ Departments: ${bar.name}, ${kitchen.name}, ${floor.name}`);
  console.log(`✅ Tables: ${tablesData.length} tables seeded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
