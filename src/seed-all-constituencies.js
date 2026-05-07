require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const dataPath = 'd:/Voting App/iBallot/data.json';
  
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: data.json not found at ${dataPath}`);
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(rawData);

  console.log("Starting full database seed (Provinces, Cities, and Constituencies)...");

  for (const provinceData of data.provinces) {
    console.log(`Processing Province: ${provinceData.name}`);
    
    // 1. Upsert Province
    const province = await prisma.province.upsert({
      where: { name: provinceData.name },
      update: {
        capital: provinceData.capital,
        assemblyPrefix: provinceData.assembly_prefix
      },
      create: {
        name: provinceData.name,
        capital: provinceData.capital,
        assemblyPrefix: provinceData.assembly_prefix
      }
    });

    for (const cityData of provinceData.cities) {
      process.stdout.write(`  Processing City: ${cityData.name} `);
      
      // 2. Upsert City
      const city = await prisma.city.upsert({
        where: {
          name_provinceId: {
            name: cityData.name,
            provinceId: province.id
          }
        },
        update: {},
        create: {
          name: cityData.name,
          provinceId: province.id
        }
      });

      // 3. Upsert Constituencies
      // National Assembly
      if (cityData.constituencies.national_assembly) {
        for (const code of cityData.constituencies.national_assembly) {
          await prisma.constituency.upsert({
            where: { code: code },
            update: {
              name: `${code} (${cityData.name})`,
              type: 'NATIONAL_ASSEMBLY',
              cityId: city.id
            },
            create: {
              name: `${code} (${cityData.name})`,
              code: code,
              type: 'NATIONAL_ASSEMBLY',
              cityId: city.id
            }
          });
          process.stdout.write('.');
        }
      }

      // Provincial Assembly
      if (cityData.constituencies.provincial_assembly) {
        for (const code of cityData.constituencies.provincial_assembly) {
          await prisma.constituency.upsert({
            where: { code: code },
            update: {
              name: `${code} (${cityData.name})`,
              type: 'PROVINCIAL_ASSEMBLY',
              cityId: city.id
            },
            create: {
              name: `${code} (${cityData.name})`,
              code: code,
              type: 'PROVINCIAL_ASSEMBLY',
              cityId: city.id
            }
          });
          process.stdout.write('.');
        }
      }
      console.log(' [Done]');
    }
  }

  console.log("\nFull seeding complete!");
}

main()
  .catch(e => {
    console.error('Fatal error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
