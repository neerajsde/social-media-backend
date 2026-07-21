import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'b42bacf9-4c13-430c-a16a-14f7ec222810';
  
  const postSelect = {
    id: true,
    likes: {
      where: { userId, isLiked: true },
      select: { userId: true },
      take: 1,
    },
  };
  
  const posts = await prisma.post.findMany({
    where: { userId },
    select: postSelect,
  });
  
  console.log("User's posts:", JSON.stringify(posts, null, 2));
  
  const likedPosts = await prisma.postLike.findMany({
    where: { userId }
  });
  
  console.log("User's liked posts:", JSON.stringify(likedPosts, null, 2));
}

main().finally(() => prisma.$disconnect());
