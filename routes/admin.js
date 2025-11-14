const express = require('express');
const router = express.Router();

// Get admin queue status
router.get('/queue', async (req, res) => {
  try {
    const queues = await req.db.collection('queues').find({}).toArray();
    res.json({ queues });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kick user from queue
router.post('/kick-user', async (req, res) => {
  try {
    const { userId, piId, printerId } = req.body;

    if (!userId || !piId || !printerId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await req.db.collection('queues').updateOne(
      { piId, printerId },
      { $pull: { queue: { userId } } }
    );

    res.json({ success: result.modifiedCount > 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get printers by owner
router.get('/printers-by-owner', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    console.log('Fetching printers for phone:', phone);
    const printers = await req.db.collection('printers')
      .find({ phone })
      .toArray();
    
    console.log('Found printers:', printers.length);
    
    // Return the printers array directly (not wrapped in an object)
    res.json(printers);
  } catch (error) {
    console.error('Error fetching printers by owner:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;