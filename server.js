// ============================================================
// server.js  –  MBME Pay Express Server for Bolt / Horizon
// npm install express uuid
// node server.js
// ============================================================

const express = require('express');
const {
  hostedPagePayment,
  createEmbeddedOrder,
  createPaymentLink,
  directPay,
  checkPaymentStatus,
  processRefund,
  verifyWebhook,
} = require('./mbme');

const app  = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || 'https://yourdomain.com';

app.use(express.json());

// ── 1. Hosted Page ───────────────────────────────────────────
// POST /api/pay/hosted
// Body: { amount, currency?, name, email, phone, reference? }
// Returns payment URL → redirect your customer there
app.post('/api/pay/hosted', async (req, res) => {
  try {
    const result = await hostedPagePayment({
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

// ── 2. Embedded iFrame – Create Order ───────────────────────
// POST /api/pay/embedded
// Body: { amount, currency?, name, email, phone, reference? }
// Returns: { oid, uid, timestamp } → pass to frontend SecurePayment widget
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

// ── 3. Payment by Link ───────────────────────────────────────
// POST /api/pay/link
// Body: { amount, currency?, name, email, phone, reference? }
// Returns: { paymentLink: "https://pgapi.mbme.org/pay/..." }
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

// ── 4. Direct Pay ────────────────────────────────────────────
// POST /api/pay/direct
// Body: { amount, currency?, name, email, phone, reference?,
//         card_number, card_cvv, card_expiry_month, card_expiry_year, card_name }
// If response.status = AUTHENTICATED → redirect user to response.payment_info.payment_url
app.post('/api/pay/direct', async (req, res) => {
  try {
    const result = await directPay({
      amount:           req.body.amount,
      currency:         req.body.currency || 'AED',
      customerName:     req.body.name,
      customerEmail:    req.body.email,
      customerPhone:    req.body.phone,
      referenceNumber:  req.body.reference,
      cardNumber:       req.body.card_number,
      cardSecurityCode: req.body.card_cvv,
      cardExpiryMonth:  req.body.card_expiry_month,
      cardExpiryYear:   req.body.card_expiry_year,
      cardName:         req.body.card_name,
    });

    if (result.status === 'AUTHENTICATED' && result.payment_info?.payment_url) {
      return res.json({ redirect: result.payment_info.payment_url, ...result });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. Payment Status ────────────────────────────────────────
// POST /api/pay/status
// Body: { oid: "uuid-of-the-order" }
app.post('/api/pay/status', async (req, res) => {
  try {
    const result = await checkPaymentStatus(req.body.oid);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Refund ────────────────────────────────────────────────
// POST /api/pay/refund
// Body: { oid, amount, reason? }
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

// ── 7. Webhook  (MBME calls this after every transaction) ────
// Configure this URL in merchant portal → Account & Settings → Webhooks
// URL to enter: https://yourdomain.com/api/webhook/mbme
app.post('/api/webhook/mbme', (req, res) => {
  res.status(200).json({ received: true }); // respond immediately

  const { secure_sign, ...payload } = req.body;

  if (!verifyWebhook(payload, secure_sign)) {
    console.error('[MBME Webhook] ❌ Invalid signature - possible tamper');
    return;
  }

  const d = payload.data || {};
  console.log(`[MBME Webhook] Order: ${d.oid} | Status: ${d.status} | Ref: ${d.mbme_payment_id}`);

  // ✅ Update your database here:
  // if (d.status === 'APPROVED') { markOrderPaid(d.oid); }
  // if (d.status === 'DECLINED') { markOrderFailed(d.oid); }
});

// ── Success / Failure redirect pages ────────────────────────
app.get('/payment-success', (req, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:50px">
      <h1>✅ Payment Successful!</h1>
      <p>Thank you. Your transaction has been completed.</p>
      <a href="/">Back to Home</a>
    </body></html>
  `);
});

app.get('/payment-failed', (req, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:50px">
      <h1>❌ Payment Failed</h1>
      <p>Something went wrong. Please try again.</p>
      <a href="/">Back to Home</a>
    </body></html>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ MBME Pay server running on port ${PORT}`);
});
