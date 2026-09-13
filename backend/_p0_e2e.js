const BASE = "http://localhost:4000/api/v1";
let cookie = null;

async function call(method, path, body, isForm, formData) {
  const headers = {};
  if (cookie) headers["Cookie"] = cookie;
  if (body && !isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? formData : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  // 1. Login
  const login = await call("POST", "/auth/login", { username: "admin", password: "admin123" });
  console.log("LOGIN:", login.status);
  if (login.status !== 200) { console.log(JSON.stringify(login.data)); process.exit(1); }

  // 2. Read current page
  const page0 = await call("GET", "/constructor/pages/marketplace-home");
  console.log("GET PAGE:", page0.status, "draft:", page0.data.draftVersion, "current:", page0.data.currentVersion);

  // 3. Save header config with marker value
  const MARKER = `P0E2E-${Date.now()}`;
  const headerCfg = {
    logo: null,
    companyName: { ru: MARKER, az: MARKER, en: MARKER },
    phone: "+99412345678",
    email: "e2e@test.az",
    address: "Baku",
    navVisible: true,
  };
  const saved = await call("PUT", "/constructor/pages/marketplace-home/header", { config: headerCfg });
  console.log("SAVE HEADER:", saved.status, "marker:", MARKER);

  // 4. Verify page record contains marker (persistence proof)
  const page1 = await call("GET", "/constructor/pages/marketplace-home");
  const ru = (page1.data.headerConfig?.companyName || {}).ru;
  console.log("PAGE RECORD companyName.ru:", ru, ru === MARKER ? "✅ PERSISTED" : "❌ NOT PERSISTED");

  // 5. Save draft (sections) to bump draftVersion
  const sections = page1.data.sections.map((s, i) => ({
    blockType: s.blockType, blockInstanceId: s.blockInstanceId, sortOrder: i,
    enabled: s.enabled, settings: s.settings, style: s.style, responsive: s.responsive,
    dataSource: s.dataSource, visibility: s.visibility, localeContent: s.localeContent,
  }));
  const draft = await call("PUT", "/constructor/pages/marketplace-home/sections", { sections });
  console.log("SAVE DRAFT:", draft.status, "draftVersion:", draft.data.draftVersion);

  // 6. Publish
  const pub = await call("POST", "/constructor/pages/marketplace-home/publish");
  console.log("PUBLISH:", pub.status, "currentVersion:", pub.data.currentVersion);

  // 7. GET Published — must contain marker
  const published = await call("GET", "/constructor/pages/marketplace-home/published");
  const pubRu = (published.data.headerConfig?.companyName || {}).ru;
  console.log("PUBLISHED companyName.ru:", pubRu, pubRu === MARKER ? "✅ PUBLISHED CONTAINS NEW VALUE" : "❌ STALE");

  // 8. Restore original-ish header (keep test data sane) — set ru back to TravelHub but keep evidence
  console.log("MARKER_FOR_REPORT:", MARKER);
  process.exit(pubRu === MARKER ? 0 : 1);
})();
