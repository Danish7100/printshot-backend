const express = require('express');
const wsManager = require('../websocket');

const router = express.Router();

function requirePiAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const expectedToken = process.env.PI_BEARER_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({ error: 'Pi authentication token is not configured.' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  next();
}

router.post('/job-status', requirePiAuth, async (req, res) => {
  try {
    const { trackingId, status, printerName, realPiId, details } = req.body || {};

    if (!trackingId || !status || !printerName || !realPiId) {
      return res.status(400).json({ error: 'trackingId, status, printerName, and realPiId are required' });
    }

    if (!req.db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const normalizedStatus = String(status).toLowerCase();
    const jobsCollection = req.db.collection('printJobs');
    const job = await jobsCollection.findOne({ trackingId });

    if (!job) {
      return res.status(404).json({ error: 'Print job not found' });
    }

    if (job.realPiId !== realPiId) {
      return res.status(409).json({ error: 'realPiId does not match the print job' });
    }

    const update = {
      status: normalizedStatus,
      realPiId,
      printerName,
      lastPiEventAt: new Date(),
      updatedAt: new Date()
    };

    if (details) {
      update.piEventDetails = details;
    }

    if (normalizedStatus === 'printing') {
      update.printingStartedAt = new Date();
    }

    if (normalizedStatus === 'completed') {
      update.completedAt = new Date();
    }

    if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
      update.failedAt = new Date();
    }

    await jobsCollection.updateOne({ _id: job._id }, { $set: update });

    const wsPayload = {
      type: normalizedStatus === 'completed'
        ? 'printComplete'
        : normalizedStatus === 'failed' || normalizedStatus === 'error'
          ? 'printFailed'
          : 'printStatus',
      trackingId,
      jobId: job._id.toString(),
      realPiId,
      printerName,
      status: normalizedStatus,
      message:
        normalizedStatus === 'completed'
          ? 'Your document has finished printing.'
          : normalizedStatus === 'failed' || normalizedStatus === 'error'
            ? 'Printing failed on the device.'
            : `Printer status changed to ${normalizedStatus}.`,
      details: details || null
    };

    if (job.userId) {
      wsManager.notifyUser(job.userId, wsPayload);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Pi Events] Error handling job status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
