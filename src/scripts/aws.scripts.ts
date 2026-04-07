import readline from "readline";
import { deleteFiles, getAllKeys } from "../services/aws.js";
import { prisma } from "../config/prisma.config.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askConfirmation = (question: string) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
};

(async () => {
  const keysArray = await getAllKeys();

  const arr = ["logo.png"];

  // exclude to file "logo.png" and "video.mp4" from keysArray
  const filteredKeys = keysArray.filter(key => !arr.includes(key));
  // const filteredKeys = arr;

  keysArray.length = 0; 
  keysArray.push(...filteredKeys);
  console.log(`Found ${keysArray.length} files to delete.`);

  if( keysArray.length === 0 ) {
    console.log("⚠️ No files to delete. Exiting.");
    rl.close();
    return;
  }

  const userInput = await askConfirmation("Are you sure you want to delete these files? (yes/no): ");

  if (userInput === "yes" || userInput === "y") {
    await deleteFiles(keysArray);

    await prisma.awsUploads.deleteMany({
        where: {fileKey: {in: keysArray}}
    })

    console.log("\n✅ Deletion process completed.");
  } else {
    console.log("\n❌ Operation cancelled by user.");
  }

  rl.close();
})();
