# Lightweight Node image
FROM node:24-alpine

# App directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the project
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript -> dist
RUN npm run build

# Expose API port
EXPOSE 4000

# Start server
CMD ["npm", "start"]