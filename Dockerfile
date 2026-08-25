FROM node:18-alpine

WORKDIR /usr/src/app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application
COPY . .

# Make sure the uploads folder exists inside the container
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "server.js"]
