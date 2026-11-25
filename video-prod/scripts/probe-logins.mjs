// Проверка учётных записей стенда через /api/v1/auth/login
const BASE = process.env.API_BASE ?? "http://127.0.0.1:4000/api/v1";

const accounts = [
  ["admin", "admin123"],
  ["director", "director1234"],
  ["elvira", "elvira1234"],
  ["natalya", "natalya1234"],
  ["finance", "finance1234"],
];

for (const [username, password] of accounts) {
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    let role = "";
    try {
      const data = JSON.parse(text);
      const u = data?.user ?? data;
      role = u?.role?.code ?? u?.roleCode ?? u?.role ?? "";
    } catch {}
    console.log(`${username}: HTTP ${res.status}${role ? " | role=" + role : ""} | ${text.slice(0, 160)}`);
  } catch (e) {
    console.log(`${username}: ERROR ${e.message}`);
  }
}
