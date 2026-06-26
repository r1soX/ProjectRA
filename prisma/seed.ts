import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = "v.smolin";
  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`Admin "${username}" already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash("Qq123456", 10);
  await prisma.user.create({
    data: {
      username,
      name: "В. Смолин",
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Created admin "${username}" (password: Qq123456).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
