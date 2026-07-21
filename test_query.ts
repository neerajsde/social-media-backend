import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'b42bacf9-4c13-430c-a16a-14f7ec222810';
  const sliceLimit = 4;
  try {
    const res = await prisma.$queryRaw`
      SELECT id FROM "Post"
      WHERE status = 'active'
        AND visibility = 'public'
        AND "isReply" = false
        AND "userId" != ${userId}
      ORDER BY RANDOM()
      LIMIT ${sliceLimit}
    `;
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}

main().finally(() => prisma.$disconnect());
