const crypto = require('crypto');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'pgapi.mbme.org';
const API_KEY  = 'dBFXdcv79Vm7Xp76nEDPC/vaaYTZJKlA28mt3Fa9bXs=';
const UID      = '343';
const HASH_KEY = '69aab37d89de4b3838b30a01';

function generateSecureSign(payload) {
  const uid       = payload.uid || UID;
  const oid       = payload.oid || '';
  const amount    = payload.transaction_info?.amount || '';
  const currency  = payload.transaction_info?.currency || '';
  const timestamp = payload.timestamp || '';
  const string    = uid + oid + amount + currency + timestamp + HASH_KEY;
  return crypto.createHash('sha256').update(string).digest('hex');
}

function getTimestamp() {
  return new Date().toISOString();
}

function flattenForForm(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenForForm(obj[key], fullKey));
    } else {
      acc[fullKey] = obj[key];
    }
    return acc;
  }, {});
}

function apiRequest(path, body) {
  return new Promise((resolve, reject) => {
    const flat = flattenForForm(body);
    const data = new URLSearchParams(flat).toString();

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Authorization':  API_KEY,
        'Accept':         'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error('Invalid JSON from MBME: ' + responseData.substring(0, 300)));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

async function createEmbeddedOrder({
  amount, currency = 'AED', customerName, customerEmail,
  customerPhone, mobileCountryCode = '+971', referenceNumber,
  successUrl, failureUrl,
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
    transaction_info: { amount, currency },
    payment_info: {
      payment_method_id: 1,
      save_card:         false,
      token_reference:   '',
    },
    client_info: { reference_number: referenceNumber || '' },
    response_config: {
      success_redirect_url: successUrl || '',
      failure_redirect_url: failureUrl || '',
    },
  };

  payload.secure_sign = generateSecureSign(payload);

  const data = await apiRequest('/api/v2/payments', payload);

  const paymentUrl = data?.result?.payment_url
    || data?.data?.payment_url
    || data?.payment_url
    || data?.redirect_url;

  return { ...data, oid, uid: UID, timestamp, payment_url: paymentUrl };
}

async function createPaymentLink({
  amount, currency = 'AED', customerName, customerEmail,
  customerPhone, mobileCountryCode = '+971', referenceNumber,
  expiryUtc, successUrl, failureUrl,
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
    transaction_info: { amount, currency },
    payment_info: { payment_method_id: '', save_card: false },
    payment_expiry: paymentExpiry,
    client_info: { reference_number: referenceNumber || '' },
    response_config: {
      success_redirect_url: successUrl || '',
      failure_redirect_url: failureUrl || '',
      disable_redirects:    false,
    },
  };

  payload.secure_sign = generateSecureSign(payload);
  const data = await apiRequest('/api/v2/payments/create-order', payload);
  return data;
}

async function checkPaymentStatus(oid) {
  const timestamp = getTimestamp();
  const payload = { uid: UID, timestamp, request_method: 'order_status', oid };
  payload.secure_sign = generateSecureSign(payload);
  return await apiRequest('/api/v2/order', payload);
}

async function processRefund({ oid, amount, refundRemarks = 'Customer request' }) {
  const timestamp = getTimestamp();
  const payload = {
    uid: UID, oid,
    amount: String(amount),
    timestamp,
    request_method: 'process_refund',
    refund_remarks: refundRemarks,
  };
  payload.secure_sign = generateSecureSign(payload);
  return await apiRequest('/api/v2/order', payload);
}

function verifyWebhook(incomingPayload, receivedSign) {
  const { secure_sign, ...rest } = incomingPayload;
  return generateSecureSign(rest) === receivedSign;
}

module.exports = {
  createEmbeddedOrder,
  createPaymentLink,
  checkPaymentStatus,
  processRefund,
  verifyWebhook,
};
