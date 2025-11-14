const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Register printer
router.post('/register', async (req, res) => {
  try {
    const { ownerName, piId, printerName, address, phone, costPerPage } = req.body;

    if (!ownerName || !piId || !printerName || !address || !phone || costPerPage === undefined) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const fakePiId = uuidv4();
    const fakePrinterId = uuidv4();

    const newPrinter = {
      ownerName,
      piId,
      printerName,
      address,
      phone,
      costPerPage: parseFloat(costPerPage),
      fakePiId,
      fakePrinterId,
      createdAt: new Date(),
    };

    await req.db.collection('printers').updateOne(
      { piId: piId, printerName: printerName },
      { $set: newPrinter },
      { upsert: true }
    );

    res.status(201).json({
      message: 'Printer registered successfully',
      fakePiId: fakePiId,
      fakePrinterId: fakePrinterId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get printer details
router.get('/details', async (req, res) => {
  try {
    const { piId, printerId } = req.query;

    if (!piId || !printerId) {
      return res.status(400).json({ error: 'Missing piId or printerId' });
    }

    const printer = await req.db.collection('printers').findOne(
      { fakePiId: piId, fakePrinterId: printerId },
      { projection: { _id: 0, costPerPage: 1, ownerName: 1, address: 1 } }
    );

    if (!printer) {
      return res.status(404).json({ error: 'Printer not found.' });
    }

    res.json(printer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify owner
router.post('/verify-owner', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const owner = await req.db.collection('printers').findOne({ phone });

    if (!owner) {
      return res.status(404).json({ error: 'No printer owner found with this phone number.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get printer status
router.get('/status', async (req, res) => {
  try {
    const { printerName } = req.query;

    if (!printerName) {
      return res.status(400).json({ error: 'Printer name is required' });
    }

    // For now, return mock status. In production, this would check actual printer status
    const mockStatuses = ['idle', 'busy', 'offline', 'error'];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
    
    res.json({ status: randomStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;