import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  console.log("User:", user?.id);
  if (!user) return;
  
  const post = await prisma.post.findFirst({
    where: { likes: { some: { userId: user.id, isLiked: true } } },
    include: { likes: { where: { userId: user.id } } }
  });
  console.log("Liked Post:", post?.id, post?.likes);

  if (post) {
    const postSelect = {
      likes: {
        where: { userId: user.id, isLiked: true },
        select: { userId: true },
        take: 1,
      }
    };
    const feed = await prisma.post.findUnique({
      where: { id: post.id },
      select: postSelect
    });
    console.log("Feed Output:", JSON.stringify(feed, null, 2));
  }
}
main();
