const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

// ── CREDENTIALS ─────────────────────────────
const BASE_URL = "https://pgapi.mbme.org/api/v2/payments";
const API_KEY  = "Zk/zb/RXoUgt1gs+vYd1hI9ExshfD6eF6HmvhgZonCs=";
const UID      = "343";

// ⚠️ STATIC SIGN
const SECURE_SIGN = "e8ca5e43e4f0ee726cb438f2c6f46849fba67f27e6d40b41adbbe7be1f8da871";

// ── HEADERS (ONLY AUTH AS REQUESTED) ───────
function getHeaders() {
  return {
    Authorisation: API_KEY
  };
}

// ── PAYMENT FUNCTION ───────────────────────
async function createPayment({
  amount,
  customerName,
  customerEmail,
  customerPhone,
  successUrl,
  failureUrl
}) {
  const payload = {
    uid: UID,
    oid: uuidv4(),
    timestamp: new Date().toISOString(),

    request_method: "embedded_pay_direct",

    customer_info: {
      name: customerName || "",
      email: customerEmail || "",
      mobile_number: customerPhone || "",
      mobile_country_code: "+971"
    },

    transaction_info: {
      amount: amount,
      currency: "AED"
    },

    payment_info: {
      payment_method_id: 1,
      save_card: false,
      token_reference: ""
    },

    client_info: {
      reference_number: "ORDER-" + Date.now()
    },

    response_config: {
      success_redirect_url: successUrl || "https://yourdomain.com/success",
      failure_redirect_url: failureUrl || "https://yourdomain.com/fail"
    },

    secure_sign: SECURE_SIGN
  };

  console.log("PAYLOAD:", payload);

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  console.log("MBME RESPONSE:", data);

  return data;
}

module.exports = { createPayment };
