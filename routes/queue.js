const express = require('express');
const { acquireLock, releaseLock, getQueue } = require('./queue-manager');
const wsManager = require('../websocket');
const router = express.Router();

// Add user to queue
router.post('/add', async (req, res) => {
  try {
    const { piId, printerId, userId } = req.body;

    if (!piId || !printerId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const success = await acquireLock(req.db, piId, printerId, userId);
    
    // Broadcast real-time update
    const updatedQueue = await getQueue(req.db, piId, printerId);
    wsManager.broadcastQueueUpdate(piId, printerId, updatedQueue);
    
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Release user from queue
router.post('/release', async (req, res) => {
  try {
    const { piId, printerId, userId } = req.body;

    if (!piId || !printerId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const success = await releaseLock(req.db, piId, printerId, userId);
    
    // Broadcast real-time update
    const updatedQueue = await getQueue(req.db, piId, printerId);
    wsManager.broadcastQueueUpdate(piId, printerId, updatedQueue);
    
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get queue status
router.get('/status', async (req, res) => {
  try {
    const { piId, printerId } = req.query;

    if (!piId || !printerId) {
      return res.status(400).json({ error: 'Missing piId or printerId' });
    }

    console.log('Getting queue for:', { piId, printerId });
    
    // Check if database is connected
    if (!req.db) {
      console.error('Database not connected');
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const queue = await getQueue(req.db, piId, printerId);
    console.log('Queue result:', queue);
    
    const safeQueue = Array.isArray(queue) ? queue : [];
    console.log('Sending response:', { queue: safeQueue });
    res.json({ queue: safeQueue });
  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;