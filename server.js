const express = require('express');
const {
  createEmbeddedOrder,
  createPaymentLink,
  checkPaymentStatus,
  processRefund,
  verifyWebhook,
} = require('./mbme');

const app      = express();
const PORT     = process.env.PORT || 3000;
const SITE_URL = 'https://toohighdark.com';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.post('/api/pay/embedded', async (req, res) => {
  try {
    const result = await createEmbeddedOrder({
      amount:          req.body.amount,
      currency:        req.body.currency || 'AED',
      customerName:    req.body.name,
      customerEmail:   req.body.email,
      customerPhone:   req.body.phone,
      referenceNumber: req.body.reference,
      successUrl:      `${SITE_URL}/payment-success`,
      failureUrl:      `${SITE_URL}/payment-failed`,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pay/link', async (req, res) => {
  try {
    const result = await createPaymentLink({
      amount:          req.body.amount,
      currency:        req.body.currency || 'AED',
      customerName:    req.body.name,
      customerEmail:   req.body.email,
      customerPhone:   req.body.phone,
      referenceNumber: req.body.reference,
      successUrl:      `${SITE_URL}/payment-success`,
      failureUrl:      `${SITE_URL}/payment-failed`,
    });
    res.json({ paymentLink: result.data?.payment_link, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pay/status', async (req, res) => {
  try {
    const result = await checkPaymentStatus(req.body.oid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pay/refund', async (req, res) => {
  try {
    const result = await processRefund({
      oid:           req.body.oid,
      amount:        req.body.amount,
      refundRemarks: req.body.reason || 'Customer request',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/webhook/mbme', (req, res) => {
  res.status(200).json({ received: true });
  const { secure_sign, ...payload } = req.body;
  if (!verifyWebhook(payload, secure_sign)) {
    console.error('[MBME Webhook] Invalid signature');
    return;
  }
  const d = payload.data || {};
  console.log(`[MBME Webhook] Order: ${d.oid} | Status: ${d.status}`);
});

app.get('/payment-success', (req, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:50px">
      <h1>✅ Payment Successful!</h1>
      <p>Thank you. Your transaction has been completed.</p>
      <a href="https://toohighdark.com">Back to Home</a>
    </body></html>
  `);
});

app.get('/payment-failed', (req, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:50px">
      <h1>❌ Payment Failed</h1>
      <p>Something went wrong. Please try again.</p>
      <a href="https://toohighdark.com/checkout">Try Again</a>
    </body></html>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ MBME Pay server running on port ${PORT}`);
});
