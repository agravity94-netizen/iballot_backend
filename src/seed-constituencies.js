const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = [
    { name: 'NA-120 (Lahore-III)', code: 'NA-120', type: 'NATIONAL_ASSEMBLY' },
    { name: 'NA-240 (Karachi-II)', code: 'NA-240', type: 'NATIONAL_ASSEMBLY' },
    { name: 'PK-70 (Peshawar)', code: 'PK-70', type: 'PROVINCIAL_ASSEMBLY' },
  ];

  for (const item of data) {
    await prisma.constituency.upsert({
      where: { code: item.code },
      update: {},
      create: item,
    });
  }
  console.log('Seeding complete.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
