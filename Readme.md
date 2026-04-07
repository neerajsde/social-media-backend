# socail-media Backend: A Guide for Junior Developers

Welcome to the **socail-media Backend** project! Think of this guide as your map to navigating this codebase. We'll break down how everything works step by step, using simple language and analogies.

---

## 1. What problem this project solves

Imagine a modern social media platform where creators (Stars) and users interact. The **socail-media Backend** is the engine powering this platform. It handles everything behind the scenes so users can:
- Create accounts and log in securely.
- Post content (text, images, videos, reels).
- Like, comment, share, and bookmark posts.
- Follow other users and get notified about activities.
- Let Admins moderate the platform, manage ads, and oversee premium features.

**Analogy:** If socail-media was a restaurant, the frontend (app/website) is the dining area where customers order. This backend is the **Kitchen**—it receives orders (requests), cooks the meals (processes data), and sends them back out to the customers.

---

## 2. Tech Stack Used and Why

Here are the main tools we use in our "Kitchen":

- **Node.js & Express:** The core framework. Express is like the kitchen's expeditor—it quickly receives requests and routes them to the right cooking station.
- **TypeScript:** Adds strict rules to JavaScript. It's like having a standardized recipe book so no chef accidentally uses salt instead of sugar.
- **Prisma (ORM) & PostgreSQL:** PostgreSQL is our massive pantry (database). Prisma is the smart inventory manager that lets us fetch or save data using TypeScript instead of writing raw SQL queries.
- **Redis:** A super-fast temporary memory cache. We use it to store things we need instantly, like blacklisted login tokens. Think of it as the chef's front-pocket notepad.
- **BullMQ:** A queue system. If a task takes too long (like sending 1000 emails), instead of making the user wait, BullMQ puts it on a "to-do list" to be handled in the background.
- **AWS S3 & CloudFront:** Used for storing and rapidly delivering images and videos globally.

---

## 3. Folder Structure

The project is organized into "feature modules" so it's easy to find things:

- `src/server.ts` & `src/app.ts`: The absolute starting points.
- `src/config/`: Setup files for Database, Redis, Queues, etc.
- `src/middlewares/`: Security guards and helpers (e.g., checking if you're logged in, rate-limiting, error handling).
- `src/modules/`: **The core of the app.** Divided by features:
  - `/auth`: Login, registration, OTP.
  - `/user`: Profiles, following, premium status.
  - `/post`: Creating posts, liking, commenting.
  - `/admin`: Moderation, Ad management.
- `src/routes/`: Connects all the module routes under `/api/v1`.
- `src/jobs/`: Background workers (e.g., `email-worker.js`).

---

## 4. Entry Point of the Application

The absolute starting point is `src/server.ts`.
When you run the app, this file:
1. Imports the Express app from `src/app.ts`.
2. Connects to Redis.
3. Opens the "restaurant doors" by listening on a specific port (e.g., 8000).

`src/app.ts` is where the core setup happens: it adds security helmets, rate limiters, CORS (who is allowed to visit), and connects the main `/api/v1` routes.

---

## 5. How Requests Flow Through the System

**The Restaurant Analogy (Request Flow):**

1. **Client (Customer):** "I want to see my profile." (Sends a `GET /api/v1/user/profile` request).
2. **App.ts (Maitre D'):** Checks basic security (Rate Limiting, CORS).
3. **Router (Waiter):** Looks at the menu and routes the request to the specific module.
4. **Middleware (Bouncer):** `auth.ts` intercepts. "Wait, show me your ID (JWT Token)." It verifies the token and attaches the user's ID to the request.
5. **Controller (Head Chef):** Receives the localized request. It says, "Okay, Service, go get me this user's data!"
6. **Service (Sous Chef):** Uses Prisma to actually talk to the database and get the user's profile.
7. **Response (Delivery):** The data goes back up the chain and is sent to the customer as JSON.

---

## 6. Database Interactions

We use **Prisma**. If you look in `prisma/schema.prisma`, you'll see "models". Each model represents a table in the PostgreSQL database.
- `User`: Stores emails, passwords, follower counts.
- `Post`: Stores content, media URLs, like counts.
- `Comment`, `Follow`, `Ad`, etc.

When the service module wants to find a user, it just runs `prisma.user.findUnique({ where: { id } })`. Prisma safely transforms that into a SQL query.

---

## 7. Authentication/Authorization Flow

We use a strong **Zero-Trust Session** model using **JWT (JSON Web Tokens)**:

1. **Login:** A user logs in (e.g., via OTP). The system verifies it and creates a `UserSession` in the database.
2. **Token Generation:** We generate a JWT containing the `sessionId` and `role` (user/admin) and give it to the client.
3. **Subsequent Requests:** The client sends the token. The `auth.ts` middleware verified the token signature, ensures it isn't blacklisted in Redis, and checks the database to ensure the session hasn't expired or been revoked. Finally, it checks if the IP address matches.
4. **Authorization:** We have roles (`user`, `moderator`, `admin`, `superadmin`). Some routes are protected by `requireRoles('admin')`, which strictly checks the user's role before letting them proceed.

---

## 8. Important Services or Modules

- **Auth Module:** Handles the complex flows of OTPs, social logins, 2FA (Two-Factor Auth), password resets, and sessions.
- **Post Module:** Not just text. It handles generating **Presigned URLs** from AWS S3. Instead of uploading a 50MB video to our server, the server gives the client a temporary "ticket" (URL) to upload directly to AWS, saving our bandwidth.
- **Admin Module:** Separate secure area for admins to view reports, manage permissions, and approve ads. Admin routes strictly ensure the user has the `admin` or `superadmin` role.

---

## 9. Any Caching, Queues, or External Services

- **Caching (Redis):** If a user logs out, their token is immediately blacklisted in Redis. Redis is incredibly fast, so checking this on every request adds zero delay.
- **Queues (BullMQ):** `src/jobs/email-worker.js` and `notification-worker.js`. When a user signs up, we need to send a welcome email. Instead of making them wait 3 seconds for the email to send, we just toss the job into BullMQ and instantly return a "Success" to the user. BullMQ picks it up a millisecond later and sends it in the background.
- **External Services:** AWS S3 (Storage), AWS CloudFront (Fast global delivery of S3 media), and Nodemailer (Sending emails).

---

## 10. Final Summary of the Architecture

The **socail-media Backend** is a highly scalable, modular monolithic application. 
- It uses **Express** for fast HTTP routing and **TypeScript** for reliability.
- **Prisma + PostgreSQL** acts as the solid foundation for relational data.
- It prevents bottlenecks by offloading heavy tasks to **BullMQ backend workers**.
- Finally, it strictly secures user data using zero-trust JWT sessions, Redis blacklists, and role-based access control.

In short, it's a modern, robust kitchen built to serve hundreds of thousands of users smoothly without catching on fire!
