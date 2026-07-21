import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  console.log('Syncing comment counts...');
  
  // Get all posts
  const posts = await prisma.post.findMany({
    select: { id: true, _count: { select: { comments: true } } }
  });
  
  let updated = 0;
  for (const post of posts) {
    const actualCount = post._count.comments;
    
    await prisma.post.update({
      where: { id: post.id },
      data: { commentCount: actualCount }
    });
    
    updated++;
  }
  
  console.log(`Synced ${updated} posts comment counts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
