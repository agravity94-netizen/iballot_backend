const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const elections = await prisma.election.findMany({
      select: {
        id: true,
        title: true,
        status: true,
      }
    });
    console.log('Elections:');
    console.table(elections);

    try {
      const results = await prisma.$queryRaw`SELECT * FROM "ElectionResults" LIMIT 10`;
      console.log('ElectionResults View Data:');
      console.table(results);
    } catch (e) {
      console.log('ElectionResults View does not exist or error querying it:', e.message);
    }

    const voteCount = await prisma.voteReceipt.count();
    console.log('Total Vote Receipts:', voteCount);

    const candidates = await prisma.candidate.findMany({
      include: {
        voteCount: true,
        user: { select: { email: true } }
      }
    });
    console.log('Candidates and their vote counts:');
    console.table(candidates.map(c => ({
      email: c.user.email,
      electionId: c.electionId,
      status: c.status,
      count: c.voteCount?.count
    })));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
