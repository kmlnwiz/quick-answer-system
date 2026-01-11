import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // チームの初期データを作成
  const teams = [
    { name: '池袋', color: '#3246a5', display_order: 1 },
    { name: '秋葉原', color: '#eb6405', display_order: 2 },
    { name: '蒲田', color: '#824628', display_order: 3 },
    { name: '名古屋', color: '#e61e55', display_order: 4 },
    { name: '大阪', color: '#1eaabe', display_order: 5 },
  ];

  for (const team of teams) {
    await prisma.team.upsert({
      where: { id: team.display_order },
      update: {},
      create: team,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
