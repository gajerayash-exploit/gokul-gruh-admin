// Production-safe seed (runnable with plain `node`, no tsx/devDeps).
// Mirrors prisma/seed.ts. Idempotent: never overwrites an existing admin,
// so a password changed in-app is preserved across deploys/restarts.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@gokulgruh.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeThisPassword123!";
  const name = process.env.SEED_ADMIN_NAME ?? "Kripal Dobariya";

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Admin already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.admin.create({ data: { email, name, passwordHash } });
    console.log(`✓ Created admin: ${email}`);
  }

  const settings = await prisma.businessSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    await prisma.businessSettings.create({
      data: {
        id: 1,
        businessName: "Gokul Gruh Udhyog",
        contactPerson: "Kripal Dobariya",
        phoneNumber: "+91 9638412929",
        address: "",
        mapsQuery: "",
        logoDataUrl: "",
        orderTypes: JSON.stringify([]),
        defaultDateToday: true,
      },
    });
    console.log("✓ Created default business settings");
  } else {
    console.log("✓ Business settings already present");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
