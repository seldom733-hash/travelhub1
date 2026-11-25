// Платежи по заказу через API: создание, подтверждение, оплата поставщику
const API = "http://127.0.0.1:4000/api/v1";
const [action, orderId, amount, method, reason] = process.argv.slice(2);

const login = await fetch(`${API}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin123" }),
});
const { accessToken } = await login.json();
const H = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "Idempotency-Key": `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
};

if (action === "create") {
  const res = await fetch(`${API}/finance/payments`, {
    method: "POST", headers: H,
    body: JSON.stringify({ orderId, amount, paymentMethod: method ?? "cash", reason: reason ?? "Оплата по заказу" }),
  });
  console.log("create:", res.status, (await res.text()).slice(0, 220));
} else if (action === "confirm") {
  const res = await fetch(`${API}/finance/payments/${orderId}/confirm`, { method: "POST", headers: H, body: "{}" });
  console.log("confirm:", res.status, (await res.text()).slice(0, 220));
} else if (action === "list") {
  const res = await fetch(`${API}/orders/${orderId}/financial-history`, { headers: H });
  const data = await res.json();
  console.log(JSON.stringify(data.payments ?? data, null, 1).slice(0, 600));
}
