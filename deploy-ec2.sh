#!/bin/bash
# AWS EC2 Deployment Script for PrintShot Backend

echo "🚀 Starting PrintShot Backend Deployment..."

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install dependencies
npm install

# Start application
pm2 start server.js --name printshot-backend

# Setup PM2 to start on boot
pm2 startup
pm2 save

# Show status
pm2 status

echo "✅ Deployment complete!"
echo "Backend running on port 4000"
echo "Check logs: pm2 logs printshot-backend"
