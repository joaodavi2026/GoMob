import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoUsers } from "./demo-users";

const prisma = new PrismaClient();

async function main() {
  for (const u of demoUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
    console.log(`seeded user ${u.email} (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
