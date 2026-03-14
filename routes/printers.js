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

    const existingPrinter = await req.db.collection('printers').findOne(
      { piId: piId, printerName: printerName }
    );

    const fakePiId = existingPrinter?.fakePiId || uuidv4();
    const fakePrinterId = existingPrinter?.fakePrinterId || uuidv4();

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
      message: existingPrinter ? 'Printer updated successfully' : 'Printer registered successfully',
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
      { fakePiId: piId, fakePrinterId: printerId }
    );

    if (!printer) {
      return res.status(404).json({ error: 'Printer not found.' });
    }

    res.json({
      costPerPage: printer.costPerPage,
      ownerName: printer.ownerName,
      address: printer.address,
      piId: printer.piId,
      printerName: printer.printerName
    });
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

async function fetchLivePrinterStatus(realPiId, realPrinterName) {
  const fetch = require('node-fetch');
  const headers = {};

  if (process.env.PI_BEARER_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.PI_BEARER_TOKEN}`;
  }

  const scannerStatusUrl = `http://${realPiId}.printshot.in/scanner-status/${encodeURIComponent(realPrinterName)}`;
  const legacyStatusUrl = `http://${realPiId}.printshot.in/printer/status/${encodeURIComponent(realPrinterName)}`;

  let piRes = await fetch(scannerStatusUrl, { headers, timeout: 5000 });
  if (!piRes.ok) {
    piRes = await fetch(legacyStatusUrl, { headers, timeout: 5000 });
  }

  if (!piRes.ok) {
    const txt = await piRes.text();
    throw new Error(txt || `Pi responded with status ${piRes.status}`);
  }

  const piData = await piRes.json();
  return String(piData.status || 'unknown').toLowerCase();
}

async function fetchPiHealth(realPiId) {
  const fetch = require('node-fetch');
  const urls = [
    `http://${realPiId}.printshot.in/health`,
    `http://${realPiId}.printshot.in/`
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { timeout: 5000 });
      if (!response.ok) {
        lastError = new Error(`Pi responded with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const status = String(data.status || '').toLowerCase();
      const message = String(data.message || '').toLowerCase();
      const online = status === 'online' || message.includes('backend running') || message.includes('backend is live');

      return {
        status: status || (online ? 'online' : 'unknown'),
        online
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to contact Pi');
}

// Get printer status using real Pi information
router.get('/status', async (req, res) => {
  try {
    const { piId, printerName } = req.query;

    if (!piId || !printerName) {
      return res.status(400).json({ error: 'piId and printerName are required' });
    }

    const status = await fetchLivePrinterStatus(piId, printerName);
    res.json({ status });
  } catch (error) {
    res.status(502).json({ error: 'Failed to fetch live printer status', details: error.message });
  }
});

router.get('/health-check', async (req, res) => {
  try {
    const { piId, printerId } = req.query;
    if (!piId || !printerId) {
      return res.status(400).json({ error: 'piId and printerId required' });
    }

    const printer = await req.db.collection('printers').findOne(
      { fakePiId: piId, fakePrinterId: printerId }
    );
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    if (!printer.piId) {
      return res.status(500).json({ error: 'Printer configuration incomplete' });
    }

    const health = await fetchPiHealth(printer.piId);
    return res.json(health);
  } catch (error) {
    return res.status(502).json({ error: 'Failed to contact Pi', details: error.message });
  }
});


router.get('/busy', async (req, res) => {
  try {
    const { piId, printerId } = req.query;
    if (!piId || !printerId) {
      return res.status(400).json({ error: 'piId and printerId required' });
    }

    const printer = await req.db.collection('printers').findOne(
      { fakePiId: piId, fakePrinterId: printerId }
    );
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    const realPiId = printer.piId;
    const realPrinterName = printer.printerName;
    if (!realPiId || !realPrinterName) {
      return res.status(500).json({ error: 'Printer configuration incomplete' });
    }

    try {
      const status = await fetchLivePrinterStatus(realPiId, realPrinterName);
      return res.json({ status });
    } catch (error) {
      console.error('[Busy API] Error connecting to printer:', error.message);
      return res.status(502).json({ error: 'Failed to contact printer', details: error.message });
    }
  } catch (error) {
    console.error('[Busy API] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: List all registered printers (for troubleshooting)
router.get('/debug/list-all', async (req, res) => {
  try {
    if (process.env.ALLOW_DEBUG_ENDPOINTS !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!req.db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const printers = await req.db.collection('printers').find({}).toArray();
    
    res.json({
      totalPrinters: printers.length,
      printers: printers.map(p => ({
        ownerName: p.ownerName,
        realPiId: p.piId,
        realPrinterName: p.printerName,
        fakePiId: p.fakePiId,
        fakePrinterId: p.fakePrinterId,
        costPerPage: p.costPerPage,
        address: p.address,
        phone: p.phone,
        qrUrl: `https://printshot.in/scanner?pi=${p.fakePiId}&printer=${p.fakePrinterId}`,
        testLink: `http://localhost:3000/scanner?pi=${p.fakePiId}&printer=${p.fakePrinterId}`
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
