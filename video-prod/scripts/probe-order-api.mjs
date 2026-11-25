// Что реально отдаёт API по туристам заказа
const BASE = "http://127.0.0.1:4000/api/v1";
const login = await fetch(`${BASE}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "director", password: "director1234" }),
});
const { accessToken } = await login.json();
const H = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

const orderId = process.argv[2];
for (const path of [`/orders/${orderId}`, `/orders/${orderId}/travelers`]) {
  const res = await fetch(`${BASE}${path}`, { headers: H });
  const body = await res.text();
  console.log(`\n### ${path} → ${res.status}`);
  console.log(body.slice(0, 900));
}
