const crypto = require("crypto");
const body = { eventId: "evt-qa-001", paymentCode: "PAY-00000033", status: "CAPTURED" };
const payload = JSON.stringify(body);
const signature = crypto.createHmac("sha256", "qa-webhook-secret").update(payload).digest("hex");
(async () => {
  for (let i = 0; i < 2; i++) {
    const res = await fetch("http://127.0.0.1:4000/api/v1/public/payments/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-signature": signature },
      body: payload,
    });
    console.log(i, res.status, await res.text());
  }
})();
