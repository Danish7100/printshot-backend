const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const http = require('http');
const wsManager = require('./websocket');

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,https://printshot-webapp.vercel.app')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.set('trust proxy', true);
app.disable('x-powered-by');

// Initialize WebSocket
wsManager.initialize(server);

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

// MongoDB connection
let db;
MongoClient.connect(process.env.MONGODB_URI)
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db('print_platform');
  })
  .catch(error => console.error('MongoDB connection error:', error));

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Routes
app.use('/api/printers', require('./routes/printers'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/documents'));
app.use('/api/pi', require('./routes/pi-events'));
app.use('/api', require('./routes/test'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  if (process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ message: 'Backend is working!', queue: [] });
});

// Test queue with mock data
app.get('/api/test-queue-data', async (req, res) => {
  try {
    if (process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    // Check if we have any printers registered
    const printers = await db.collection('printers').find({}).limit(5).toArray();
    const queues = await db.collection('queues').find({}).limit(5).toArray();
    
    res.json({ 
      message: 'Database test',
      printersCount: printers.length,
      queuesCount: queues.length,
      samplePrinters: printers,
      sampleQueues: queues
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`PrintShot backend running on port ${PORT} with WebSocket support`);
  console.log('Environment check:');
  console.log('- MongoDB:', process.env.MONGODB_URI ? '✓ Configured' : '✗ Missing');
  console.log('- Razorpay:', process.env.RAZORPAY_KEY_ID ? '✓ Configured' : '✗ Missing');
  console.log('- PI Token:', process.env.PI_BEARER_TOKEN ? '✓ Configured' : '✗ Missing');
});
