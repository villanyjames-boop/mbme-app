const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ── Credentials (Recommended: Use process.env in Railway) ────
const API_KEY  = 'Esp5T/yvlmJtsjeup/Ug4cpkY9/8CIt24obJKpu7YrA=';
const UID      = '343';
const HASH_KEY = '69aab37d89de4b3838b30a01';

// ── Base URL ─────────────────────────────────────────────────
const BASE_URL = 'https://pgapi.mbme.org/api/';

// ── Secure Sign Generator ────────────────────────────────────
function generateSecureSign(payload) {
  function flatten(obj, prefix = '') {
    return Object.keys(obj).reduce((acc, key) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof obj[key] === 'object' &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(acc, flatten(obj[key], fullKey));
      } else {
        acc[fullKey] = obj[key];
      }
      return acc;
    }, {});
  }

  const flat = flatten(payload);
  const rawSignature = Object.keys(flat)
    .sort()
    .map(k => `${k}=${flat[k]}`)
    .join('&');

  return crypto
    .createHmac('sha256', HASH_KEY)
    .update(rawSignature)
    .digest('hex');
}

// ── Standard Headers & Helpers ───────────────────────────────
function getHeaders() {
  return {
    'Authorisation': API_KEY,
  };
}

function getTimestamp() {
  return new Date().toISOString();
}

// ============================================================
// 1. HOSTED PAGE
//    Endpoint: /v2/payments/create-order
// ============================================================
async function hostedPagePayment({
  amount,
  currency = 'AED',
  customerName,
  customerEmail,
  customerPhone,
  mobileCountryCode = '+971',
  referenceNumber,
  successUrl,
  failureUrl,
}) {
  const oid       = uuidv4();
  const timestamp = getTimestamp();

  const payload = {
    uid:            UID,
    oid,
    timestamp,
    request_method: 'embedded_pay_direct',
    customer_info: {
      name:                customerName  || '',
      email:               customerEmail || '',
      mobile_number:       customerPhone || '',
      mobile_country_code: mobileCountryCode,
    },
    transaction_info: {
      amount,
      currency,
    },
    payment_info: {
      payment_method_id: 1,
      save_card:         false,
      token_reference:   '',
    },
    client_info: {
      reference_number: referenceNumber || '',
    },
    response_config: {
      success_redirect_url: successUrl || '',
      failure_redirect_url: failureUrl || '',
    },
  };

  payload.secure_sign = generateSecureSign(payload);

  const response = await fetch(`${BASE_URL}v2/payments/create-order`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('MBME API Error:', {
      endpoint: 'v2/payments/create-order',
      status: response.status,
      statusText: response.statusText,
      data: data,
      payload: payload,
    });
    throw new Error(data.status_message || 'Hosted payment failed');
  }
  return data;
}

// ============================================================
// 2. EMBEDDED PAY DIRECT
//    Endpoint: v2/payments/create-order
// ============================================================
async function createEmbeddedOrder({
  amount,
  currency = 'AED',
  customerName,
  customerEmail,
  customerPhone,
  mobileCountryCode = '+971',
  referenceNumber,
  successUrl,
  failureUrl,
}) {
  const oid       = uuidv4();
  const timestamp = getTimestamp();

  const payload = {
    uid:            UID,
    oid,
    timestamp,
    request_method: 'embedded_pay_direct',
    customer_info: {
      name:                customerName  || '',
      email:               customerEmail || '',
      mobile_number:       customerPhone || '',
      mobile_country_code: mobileCountryCode,
    },
    transaction_info: {
      amount,
      currency,
    },
    payment_info: {
      payment_method_id: '',
      save_card:         false,
    },
    client_info: {
      reference_number: referenceNumber || '',
    },
    response_config: {
      success_redirect_url: successUrl || '',
      failure_redirect_url: failureUrl || '',
    },
  };

  payload.secure_sign = generateSecureSign(payload);

  const response = await fetch(`${BASE_URL}v2/payments/create-order`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('MBME API Error:', {
      endpoint: 'v2/payments/create-order',
      status: response.status,
      statusText: response.statusText,
      data: data,
      payload: payload,
    });
    throw new Error(data.status_message || 'Order creation failed');
  }

  return { ...data, oid, uid: UID, timestamp };
}

// ============================================================
// 3. PAYMENT BY LINK
//    Endpoint: v2/payments/create-order
// ============================================================
async function createPaymentLink({
  amount,
  currency = 'AED',
  customerName,
  customerEmail,
  customerPhone,
  mobileCountryCode = '+971',
  referenceNumber,
  expiryUtc,
  successUrl,
  failureUrl,
}) {
  const oid           = uuidv4();
  const timestamp     = getTimestamp();
  const paymentExpiry = expiryUtc || new Date(Date.now() + 86400000).toISOString();

  const payload = {
    uid:            UID,
    oid,
    timestamp,
    request_method: 'payment_link',
    customer_info: {
      name:                customerName  || '',
      email:               customerEmail || '',
      mobile_number:       customerPhone || '',
      mobile_country_code: mobileCountryCode,
    },
    transaction_info: {
      amount,
      currency,
    },
    payment_info: {
      payment_method_id: '',
      save_card:         false,
    },
    payment_expiry: paymentExpiry,
    client_info: {
      reference_number: referenceNumber || '',
    },
    response_config: {
      success_redirect_url: successUrl || '',
      failure_redirect_url: failureUrl || '',
      disable_redirects:    false,
    },
  };

  payload.secure_sign = generateSecureSign(payload);

  const response = await fetch(`${BASE_URL}v2/payments/create-order`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('MBME API Error:', {
      endpoint: 'v2/payments/create-order',
      status: response.status,
      statusText: response.statusText,
      data: data,
      payload: payload,
    });
    throw new Error(data.status_message || 'Payment link creation failed');
  }
  return data;
}

// ============================================================
// 4. DIRECT PAY
//    Endpoint: v2/payments
// ============================================================
async function directPay({
  amount,
  currency = 'AED',
  customerName,
  customerEmail,
  customerPhone,
  mobileCountryCode = '+971',
  referenceNumber,
  cardNumber,
  cardSecurityCode,
  cardExpiryMonth,
  cardExpiryYear,
  cardName,
}) {
  const oid       = uuidv4();
  const timestamp = getTimestamp();

  const payload = {
    uid:            UID,
    oid,
    timestamp,
    request_method: 'direct_pay',
    customer_info: {
      name:                customerName  || '',
      email:               customerEmail || '',
      mobile_number:       customerPhone || '',
      mobile_country_code: mobileCountryCode,
    },
    transaction_info: {
      amount,
      currency,
    },
    payment_info: {
      payment_method_id:  1,
      save_card:          false,
      card_number:        cardNumber,
      card_security_code: cardSecurityCode,
      card_expiry_month:  cardExpiryMonth,
      card_expiry_year:   cardExpiryYear,
      card_name:          cardName,
    },
    client_info: {
      reference_number: referenceNumber || '',
    },
  };

  payload.secure_sign = generateSecureSign(payload);

  const response = await fetch(`${BASE_URL}v2/payments`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('MBME API Error:', {
      endpoint: 'v2/payments',
      status: response.status,
      statusText: response.statusText,
      data: data,
      payload: payload,
    });
    throw new Error(data.status_message || 'Direct pay failed');
  }
  return data;
}

// ============================================================
// 5. PAYMENT ENQUIRY
//    Endpoint: v2/order
// ============================================================
async function checkPaymentStatus(oid) {
  const timestamp = getTimestamp();

  const payload = {
    uid:            UID,
    timestamp,
    request_method: 'order_status',
    oid,
  };

  payload.secure_sign = generateSecureSign(payload);

  const response = await fetch(`${BASE_URL}v2/order`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('MBME API Error:', {
      endpoint: 'v2/order',
      status: response.status,
      statusText: response.statusText,
      data: data,
      payload: payload,
    });
    throw new Error(data.status_message || 'Status check failed');
  }
  return data;
}

// ============================================================
// 6. REFUND
//    Endpoint: v2/order
// ============================================================
async function processRefund({ oid, amount, refundRemarks = 'Customer request' }) {
  const timestamp = getTimestamp();

  const payload = {
    uid:            UID,
    oid,
    amount:         String(amount),
    timestamp,
    request_method: 'process_refund',
    refund_remarks: refundRemarks,
  };

  payload.secure_sign = generateSecureSign(payload);

  const response = await fetch(`${BASE_URL}v2/order`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('MBME API Error:', {
      endpoint: 'v2/order',
      status: response.status,
      statusText: response.statusText,
      data: data,
      payload: payload,
    });
    throw new Error(data.status_message || 'Refund failed');
  }
  return data;
}

// ============================================================
// 7. WEBHOOK VERIFICATION
// ============================================================
function verifyWebhook(incomingPayload, receivedSign) {
  const { secure_sign, ...rest } = incomingPayload;
  const expected = generateSecureSign(rest);
  return expected === receivedSign;
}

module.exports = {
  hostedPagePayment,
  createEmbeddedOrder,
  createPaymentLink,
  directPay,
  checkPaymentStatus,
  processRefund,
  verifyWebhook,
};
