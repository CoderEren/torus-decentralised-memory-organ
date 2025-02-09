# Use Node.js 20+ to match the package requirements
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for dependency installation caching
COPY package*.json ./

# Install dependencies with --legacy-peer-deps to resolve version conflicts
RUN npm install --legacy-peer-deps

# Manually install go-ipfs to prevent download failures during npm install
RUN wget https://dist.ipfs.tech/go-ipfs/v0.22.0/go-ipfs_v0.22.0_linux-amd64.tar.gz -O go-ipfs.tar.gz && \
    tar -xvzf go-ipfs.tar.gz && \
    mv go-ipfs/ipfs /usr/local/bin/ipfs && \
    chmod +x /usr/local/bin/ipfs

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the app
CMD ["node", "index.js"]
