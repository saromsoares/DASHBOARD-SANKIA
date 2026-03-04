# Use Node.js LTS (Alpine for smaller size)
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies FIRST (caching layer)
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose port
EXPOSE 3000

# Start command
CMD [ "node", "server.js" ]
