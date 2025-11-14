const express = require('express');
const router = express.Router();

// Test endpoint
router.get('/test-queue', async (req, res) => {
  try {
    // Return mock queue data for testing
    const mockQueue = [
      {
        userId: 'test@example.com',
        status: 'active',
        joinedAt: new Date(),
        locked_at: new Date().toISOString()
      },
      {
        userId: 'test2@example.com', 
        status: 'waiting',
        joinedAt: new Date(),
        locked_at: null
      }
    ];
    
    res.json({ queue: mockQueue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;