import { prisma } from './src/config/prisma.config';

async function main() {
  const bookmarks = await prisma.bookmark.findMany({
    include: {
      post: true
    }
  });
  console.log("Bookmarks length:", bookmarks.length);
  if (bookmarks.length > 0) {
    console.log("First bookmark:", bookmarks[0].userId, bookmarks[0].postId);
  }

  if (bookmarks.length > 0) {
    const userId = bookmarks[0].userId;
    // Test the exact query we use
    const testQuery = await prisma.bookmark.findMany({
      where: { userId },
      include: {
        post: {
          select: {
            id: true,
            status: true,
            content: true,
            _count: { select: { comments: true } }
          }
        }
      }
    });
    console.log("Test Query Result:", JSON.stringify(testQuery, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
