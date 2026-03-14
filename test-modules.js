#!/usr/bin/env node

/**
 * Quick test to verify all dependencies load correctly
 */

console.log('🧪 Testing module imports...\n');

try {
  const express = require('express');
  console.log('✅ express');
  
  const cors = require('cors');
  console.log('✅ cors');
  
  const dotenv = require('dotenv');
  console.log('✅ dotenv');
  
  const { MongoClient } = require('mongodb');
  console.log('✅ mongodb');
  
  const fetch = require('node-fetch');
  console.log('✅ node-fetch (v' + require('node-fetch/package.json').version + ')');
  
  const FormData = require('form-data');
  console.log('✅ form-data');
  
  const AbortController = require('abort-controller');
  console.log('✅ abort-controller');
  
  const multer = require('multer');
  console.log('✅ multer');
  
  const Razorpay = require('razorpay');
  console.log('✅ razorpay');
  
  const { v4: uuidv4 } = require('uuid');
  console.log('✅ uuid');
  
  const WebSocket = require('ws');
  console.log('✅ ws (WebSocket)');
  
  console.log('\n✅ All modules loaded successfully!');
  console.log('✅ Server is ready to start');
  
} catch (error) {
  console.error('\n❌ Module loading failed:', error.message);
  process.exit(1);
}
