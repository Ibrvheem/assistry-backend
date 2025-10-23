
FROM node:24.7.0 as build


# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --force

# Copy the rest of the application's source code
COPY . . 

# Generate the Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Step 2: Serve the app using Node 24
FROM node:24.7.0

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install production dependencies
RUN npm install --force --only=production

# Copy the built files and Prisma client from the build stage
COPY --from=build /app /app

# Expose the port the app runs on
EXPOSE 9308

# Define the command to run the app
CMD ["npm", "run", "start:prod"]
