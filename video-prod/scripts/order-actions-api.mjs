// availableActions и статус заказа под конкретной ролью
const BASE = "http://127.0.0.1:4000/api/v1";
const [username, password, orderId] = process.argv.slice(2);
const login = await fetch(`${BASE}/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const { accessToken } = await login.json();
const res = await fetch(`${BASE}/orders/${orderId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
const data = await res.json();
console.log("status:", data.status, "| paymentStatus:", data.paymentStatus, "| amount:", data.amount);
console.log("availableActions:", JSON.stringify(data.availableActions, null, 1));
console.log("travelers:", JSON.stringify((data.travelers ?? []).map((t) => ({ n: t.firstName, bd: t.birthDate, c: t.dataCompleteness }))));
