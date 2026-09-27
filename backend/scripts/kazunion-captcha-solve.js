/* Manual KazUnion captcha solver.
 *
 * Usage: node scripts/kazunion-captcha-solve.js 4200
 *
 * When the backend exhausts its auto-solve attempts it writes
 * .kazunion-session.json with { cookies, pending: { url, image } } and leaves
 * .kazunion-captcha.jpg next to it. Read the digits from the image, run this
 * script, then rerun the sync — the SAMO session becomes trusted for ALL
 * countries/states.
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const FILE = path.resolve(__dirname, "..", ".kazunion-session.json");
const digits = process.argv[2];
if (!digits || !/^\d{3,8}$/.test(digits)) {
  console.error("usage: node scripts/kazunion-captcha-solve.js <digits>");
  process.exit(1);
}
let sess;
try {
  sess = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {
  console.error("cannot read " + FILE + ": " + e.message);
  process.exit(1);
}
if (!sess.pending || !sess.pending.url) {
  console.error("no pending captcha in " + FILE);
  process.exit(1);
}
const cookies = sess.cookies || {};
function cookieHeader() {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function absorb(setCookie) {
  for (const c of setCookie || []) {
    const nv = c.split(";")[0];
    const eq = nv.indexOf("=");
    if (eq > 0) cookies[nv.slice(0, eq).trim()] = nv.slice(eq + 1).trim();
  }
}
function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      Referer: url,
      Cookie: cookieHeader(),
    };
    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = https.request(url, { method, headers, timeout: 30000 }, (res) => {
      absorb(res.headers["set-cookie"]);
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () =>
        resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }),
      );
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const post = await request(
    "POST",
    sess.pending.url,
    `antibot=${encodeURIComponent(digits)}&samo_action=antibot`,
  );
  console.log("POST -> " + post.status);
  if (post.status !== 301 && post.status !== 302) {
    console.error("unexpected status, not a redirect");
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 400));
  const get = await request("GET", sess.pending.url);
  const ok = !/captchaForm/i.test(get.text);
  if (ok) {
    sess.pending = null;
    fs.writeFileSync(FILE, JSON.stringify(sess, null, 2));
    console.log("SOLVED — session unlocked, rerun the sync.");
    process.exit(0);
  }
  console.log("FAILED — wrong digits? The code is still valid until a new image is fetched; try again.");
  process.exit(1);
})();
