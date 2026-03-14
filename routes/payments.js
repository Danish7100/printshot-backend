const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const fs = require('fs').promises;
const router = express.Router();
const {
  cleanupFile,
  createUploadMiddleware,
  dispatchPrintJob,
  maxUploadSize
} = require('./print-helper');

const upload = createUploadMiddleware();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("Razorpay API keys are not configured. Payment will not work.");
}

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Create Razorpay order
router.post('/create-razorpay-order', async (req, res) => {
  try {
    const { amount, piId, printerId, pages, userId } = req.body;

    if (!amount || !piId || !printerId || !pages || !userId) {
      return res.status(400).json({ 
        error: 'Missing or invalid required parameters.',
        details: 'amount, piId, printerId, pages, and userId are required'
      });
    }

    if (!razorpay) {
      return res.status(500).json({ error: 'Payment gateway is not configured on the server.' });
    }

    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_print_${new Date().getTime()}`,
      notes: {
        userId,
        piId,
        printerId,
        pages,
      }
    };

    const order = await razorpay.orders.create(options);
    res.json({ order_id: order.id, finalAmount: amount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create payment order.' });
  }
});

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Payment gateway is not configured on the server.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expectedSignature === signature;
}

function hasPrintPayload(req) {
  const { piId, printerId, userId } = req.body || {};
  return Boolean(req.file && piId && printerId && userId);
}

// Verify payment and optionally dispatch the print immediately.
router.post('/verify', upload.single('file'), async (req, res) => {
  try {
    const { paymentId, orderId, signature } = req.body;

    if (!paymentId || !orderId || !signature) {
      if (req.file) {
        cleanupFile(req.file.path);
      }
      return res.status(400).json({ error: 'paymentId, orderId, and signature are required.' });
    }

    const signatureValid = verifyRazorpaySignature(orderId, paymentId, signature);
    if (!signatureValid) {
      if (req.file) {
        cleanupFile(req.file.path);
      }
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    const payment = {
      paymentId,
      orderId,
      signature,
      signatureVerified: true,
      status: 'completed',
      createdAt: new Date()
    };

    let printResult = null;
    if (hasPrintPayload(req)) {
      printResult = await dispatchPrintJob(req);
      payment.printTriggered = true;
      payment.printTrackingId = printResult.trackingId;
      payment.printJobId = printResult.jobId;
    } else {
      payment.printTriggered = false;
    }

    await req.db.collection('payments').insertOne(payment);

    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('[Payment Verify] Failed to cleanup local file:', cleanupError);
      }
    }

    res.json({
      success: true,
      verified: true,
      printTriggered: Boolean(printResult),
      ...(printResult ? { print: printResult } : {})
    });
  } catch (error) {
    if (req.file) {
      cleanupFile(req.file.path);
    }

    let errorMessage = error.message;
    if (error.code === 'LIMIT_FILE_SIZE') {
      errorMessage = `File too large. Maximum allowed size is ${Math.floor(maxUploadSize / (1024 * 1024))}MB.`;
    }

    res.status(error.statusCode || 500).json({ error: errorMessage });
  }
});

module.exports = router;
