# # Step 1: Build the Next.js app in a node container
# FROM node:latest as build

# # Set the working directory in the container
# WORKDIR /app

# # Copy the package.json and package-lock.json (if available)
# COPY package*.json ./

# # Install dependencies
# RUN npm install --force

# # Copy the rest of the application's source code
# COPY . . 

# # Generate the Prisma client
# RUN npx prisma generate

# # Build the application
# RUN npm run build

# # Step 2: Serve the Next.js app using a Node.js server
# FROM node:latest

# # Set the working directory in the container
# WORKDIR /app

# # Copy package.json and package-lock.json (if available)
# COPY package*.json ./

# # Install production dependencies
# RUN npm install --force --only=production

# # Copy the built files and Prisma client from the build stage
# COPY --from=build /app /app

# # Expose the port the app runs on
# EXPOSE 9308

# # Define the command to run the app
# CMD ["npm", "run", "start:prod"]


# Use Node 24.7.0 (Debian-based for compatibility)
FROM node:24.7.0-bullseye

# Set working directory
WORKDIR /app

# Copy only package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the source code
COPY . .

# Build the project (if it's TypeScript/NestJS)
RUN npm run build

# Expose your app's port (change if needed)
EXPOSE 3000

# Start the application
CMD ["node", "dist/src/main.js"]
