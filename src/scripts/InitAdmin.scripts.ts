import { prisma } from "../config/prisma.config.js";

type Role = "admin" | "superadmin" | "moderator" | "support";

async function initAdmin(username: string, role: Role) {
    try{
        if(!username){
            console.log("Invaild username");
            return;
        }

        const user = await prisma.user.findUnique({
            where: {
                username
            }
        });
        
        if(!user){
            console.log("User not found");
            return;
        }

        const exitsAdmin = await prisma.admin.findFirst({
            where: {userId: user.id}
        });

        if(exitsAdmin){
            console.log("Admin Already exits");
        }

        const admin = await prisma.admin.create({
            data:{
                userId: user.id,
                role: role,
                isApproved: true,
                status: "active",
                permissions: ["manage_content", "manage_users"],
                createdBy: user.id
            }
        })

        if(admin){
            console.log("Admin created");
            console.log(admin);
            return;
        }

        console.log("Something went wrong");
    } catch(err){
        console.log(err);
    }
}

await initAdmin("neeraj", "superadmin");
console.log("------------------Done--------------");
process.exit(1);