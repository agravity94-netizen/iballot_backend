import prisma from './config/database';

async function test() {
  try {
    const list = await prisma.constituency.findMany({
      include: {
        city: {
          include: { province: true }
        }
      }
    });
    console.log("Total constituencies: ", list.length);
    console.log("First constituency: ", JSON.stringify(list[0], null, 2));

    const lahoreList = await prisma.constituency.findMany({
      where: {
        city: {
          name: "Lahore"
        }
      },
      include: {
        city: true
      }
    });
    console.log("Lahore constituencies: ", lahoreList.length);
  } catch (err) {
    console.error("Error running test: ", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
