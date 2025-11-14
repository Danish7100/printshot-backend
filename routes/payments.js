const express = require('express');
const Razorpay = require('razorpay');
const router = express.Router();

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("Razorpay API keys are not configured. Payment will not work.");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
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

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { paymentId, orderId, signature } = req.body;
    
    const payment = {
      paymentId,
      orderId,
      signature,
      status: 'completed',
      createdAt: new Date()
    };
    
    await req.db.collection('payments').insertOne(payment);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;