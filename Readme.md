# 🌟 Stardom Backend - Scalable Social Media Engine

[![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

A high-performance, enterprise-grade backend for a modern social media platform. Built with a modular architecture, focusing on security, scalability, and real-time engagement.

---

## 🚀 Key Features

### 👤 User & Auth System
- **Advanced Authentication**: Multi-provider support (Password, Google, Apple, Trinity Network).
- **Zero-Trust Sessions**: Device-aware session management with refresh token rotation.
- **Secure MFA**: TOTP-based Two-Factor Authentication with encrypted backup codes.
- **Privacy First**: Account deletion with a grace period, profile visibility controls (Public, Private, Followers).
- **Pro Features**: Premium subscription handling and automated batch assignments (Star 1-5) based on engagement.

### 📝 Content & Media
- **Rich Posts**: Support for Text, Images, Videos, and Reels.
- **Video Processing**: Automated transcoding to HLS for adaptive streaming using FFmpeg.
- **Processing Queue**: Asynchronous media processing and cleanup powered by BullMQ.
- **Interactions**: Threaded comments (with pinning), Likes, Bookmarks, and nested Replies.

### 💬 Real-Time & Engagement
- **Instant Messaging**: Real-time chat infrastructure using Socket.io.
- **Activity Tracking**: Comprehensive user activity logging (Views, Shares, Engagement signals).
- **Intelligent Feed**: Engagement-driven tracking for explore and personalized recommendations.
- **Global Search**: High-performance search with history tracking and case-insensitive deduplication.

### 🛡️ Security & Ops
- **Rate Limiting**: Intelligent request throttling to prevent abuse.
- **Content Security**: DOMPurify for XSS prevention and Zod for strict schema validation.
- **Centralized Logging**: Structured logging with Winston and Morgan.
- **Admin Suite**: Multi-role admin panel (Superadmin, Moderator, Support) with granular permissions.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js (TypeScript) |
| **Framework** | Express.js |
| **Database** | PostgreSQL + Prisma ORM |
| **Caching/Queue** | Redis + BullMQ |
| **Storage/CDN** | AWS S3 + CloudFront |
| **Real-time** | Socket.io |
| **Security** | JWT, bcryptjs, Helmet, Zod |
| **Infrastructure** | Docker, Docker Compose |
| **API Docs** | Swagger / OpenAPI 3.0 |

---

## 📂 Project Structure

```bash
src/
├── modules/      # Business logic grouped by domain (auth, post, user, etc.)
├── services/     # Shared services (AWS, Mail, Redis, etc.)
├── middlewares/  # Security, Auth, and Validation middlewares
├── queues/       # BullMQ job configurations
├── socket/       # Socket.io handlers
├── prisma/       # Database schema and migrations
├── config/       # Shared configuration (env, constants)
└── workers/      # Background processing workers
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Redis
- Docker (Optional)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/neerajsde/social-media-backend.git
   cd social-media-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file based on the provided configuration (see `.env.example` if available).

4. **Initialize Database:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

### Running with Docker

```bash
npm run docker:up
```

---

## 📖 API Documentation

The project includes built-in API documentation via Swagger. Once the server is running, you can access it at:
`https://backend.neerajprajapati.in/docs`

---

## 🛡 License
Distributed under the **ISC License**. See `LICENSE` for more information.

---
Developed with ❤️ by [Neeraj Prajapati](https://github.com/neerajsde)
