const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const constituencies = await prisma.constituency.findMany();
  console.log(JSON.stringify(constituencies, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
