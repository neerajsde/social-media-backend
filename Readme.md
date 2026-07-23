# 🌟 ReelTube Backend

<div align="center">

  **An Enterprise-Grade, High-Performance Social Media & OTT Infrastructure**

  [![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
  [![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
  [![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

  [API Documentation](https://backend.neerajprajapati.in/docs) • [Explore Features](#-key-features) • [Setup Guide](#-getting-started)

</div>

---

## 📖 Introduction

This repository contains the backend for **ReelTube**, a modern, high-performance social media and OTT platform. Designed with **scalability**, **security**, and **real-time engagement** in mind, it leverages a modular architecture and cutting-edge technologies to handle rich media, massive user interactions, short-form videos (Reels), and complex business logic.

### 💡 The Problem It Solves

Building a modern social media platform introduces significant engineering challenges, particularly around media handling, real-time data flow, and robust security. This backend architecture solves several critical problems:
- **Synchronous Bottlenecks in Media Processing**: Offloads heavy video transcoding (converting to HLS adaptive streaming format) and image optimization to isolated background workers via BullMQ and Redis, keeping the main API highly responsive.
- **Real-Time Scalability**: Facilitates instantaneous communication (messaging, live presence, real-time notifications) for concurrent users efficiently using Socket.io.
- **Session Hijacking & Insecure Access**: Implements an enterprise-grade zero-trust session model, encompassing device-fingerprinting, IP tracking, precise refresh token rotation, and robust Two-Factor Authentication (2FA).
- **Complex Content Discovery**: Provides a tailored data schema and deep engagement tracking mechanisms (views, interaction types, duration) needed to build and scale algorithmic feeds.
- **Global Content Delivery Bottlenecks**: Integrates natively with AWS infrastructure to seamlessly upload large assets to S3 and distribute them rapidly through CloudFront CDN.

---

## 🛠 Tech Stack & Architecture

### Core Technologies
- **Backend & Runtime**: [Node.js](https://nodejs.org/) with [TypeScript](https://www.typescriptlang.org/) and [Express.js](https://expressjs.com/) for a strongly-typed, flexible API framework.
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) for structured relational mapping and [Prisma ORM](https://www.prisma.io/) for type-safe querying and schema management.
- **Caching & Message Broker**: [Redis](https://redis.io/) paired with [BullMQ](https://docs.bullmq.io/) for high-throughput background job processing.
- **Real-Time Engine**: [Socket.io](https://socket.io/) for bi-directional, persistent websocket connections.
- **Cloud Infrastructure**: [AWS S3](https://aws.amazon.com/s3/) (storage), [AWS CloudFront](https://aws.amazon.com/cloudfront/) (CDN), and [AWS Rekognition](https://aws.amazon.com/rekognition/) (image/video analysis).
- **Security & Validation**: [Zod](https://zod.dev/) for payload validation, [JWT](https://jwt.io/) & [Speakeasy](https://github.com/speakeasyjs/speakeasy) for Auth/2FA, along with Helmet, Express Rate Limit, and DOMPurify for API protection.
- **Media Processing**: [FFmpeg](https://ffmpeg.org/) (via fluent-ffmpeg) for video segmentation & transcoding.

### Project Architecture
The project follows a **Domain-Driven Modular Architecture**, ensuring that each feature set (Auth, Posts, Users) is self-contained yet interoperable.

```bash
src/
├── modules/      # Domain-specific logic (Auth, User, Post, Chat, Search, Marketplace)
├── services/     # Cross-cutting services (AWS S3, Redis, Mailer, Logger)
├── middlewares/  # Validation, Auth, Security (Helmet, CORS, Rate-Limiting)
├── queues/       # Job definitions and BullMQ configurations
├── workers/      # Isolated workers for heavy lifting (e.g., Video transcoding)
├── socket/       # Real-time communication handlers
├── prisma/       # Schema definitions and custom generated client
└── scripts/      # Administrative and maintenance scripts
```

---

## 📊 Database Schema Overview

The following diagram illustrates the core relationships within the system. The infrastructure supports complex features like device-aware sessions, nested comments, and advanced engagement tracking.

```mermaid
erDiagram
    USER ||--o| USER_PROFILE : "has"
    USER ||--o{ USER_SESSION : "manages"
    USER ||--o{ POST : "creates"
    USER ||--o{ COMMENT : "writes"
    USER ||--o{ POST_LIKE : "likes"
    USER ||--o{ FOLLOW : "follows/followed by"
    USER ||--o{ USER_ACTIVITY : "performs"
    
    POST ||--o{ COMMENT : "contains"
    POST ||--o{ POST_LIKE : "received"
    POST ||--o{ POST_VIEW : "tracks"
    POST ||--o{ POST_HASHTAG : "tagged with"
    POST ||--o| VIDEO : "contains (optional)"
    POST ||--o| REEL : "contains (optional)"
    
    COMMENT ||--o{ COMMENT : "replies (recursive)"
    COMMENT ||--o{ COMMENT_LIKE : "likes"
```

---

## 🚀 Key Features

### 🛡️ Enterprise Security
- **Zero-Trust Sessions**: Device and IP tracking with refresh token rotation and revocation.
- **Two-Factor Authentication (2FA)**: Full TOTP implementation with encrypted one-time backup codes.
- **Account Protection**: Automated deletion scheduling with a grace period for recovery.

### 📽️ Rich Media Engine
- **Automated Video Processing**: Integration with FFmpeg for segmenting videos into HLS (m3u8) for adaptive streaming.
- **Asynchronous Workflows**: Heavy media tasks are offloaded to BullMQ workers to keep the main thread responsive.
- **CDN Integration**: Optimized content delivery via AWS CloudFront.

### 💬 Real-Time & Engagement
- **Scalable Chat**: Socket.io-powered messaging with presence tracking (online/offline status).
- **Intelligent Discovery**: Engagement signals (views, duration, interaction types) tracked for personalized feed generation.
- **Pro Batch System**: Automatic tier assignment (Star 1-5) based on engagement metrics.

### ⚙️ Admin & Ops
- **RBAC (Role Based Access Control)**: Granular permissions for Superadmins, Moderators, and Support staff.
- **Centralized Monitoring**: Structured logging with Winston and request tracking with Morgan.
- **API Quality**: Strict schema validation using Zod and comprehensive Swagger documentation.

---

## 🚦 Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: v14+
- **Redis**: v6+
- **FFmpeg**: Required for media processing workers

### Installation

1. **Clone & Install**
   ```bash
   git clone https://github.com/neerajsde/social-media-backend.git
   cd social-media-backend
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the root. Use the provided template below:
   ```env
   # Core
   PORT=7682
   DATABASE_URL="postgresql://user:pass@localhost:5432/db_name"
   
   # Redis & Queues
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # Security
   JWT_ACCESS_SECRET=your_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   
   # AWS (S3 & CloudFront)
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=ap-southeast-2
   AWS_CDN_URL=https://cdn.example.com
   ```

3. **Database Initialization**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run the Application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm run start
   ```

---

## 📖 API Documentation

The API is fully documented using Swagger/OpenAPI 3.0. 
- **Local Access**: `http://localhost:7682/docs`
- **Production Reference**: `https://backend.neerajprajapati.in/docs`

---

## 🛡 License
This project is licensed under the **ISC License**.

---
<div align="center">
  Developed with ❤️ by <a href="https://github.com/neerajsde">Neeraj Prajapati</a>
</div>
