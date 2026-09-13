const fs = require("fs");
const BASE = "http://localhost:4000/api/v1";
let cookie = null;

async function call(method, path, body, formData) {
  const headers = {};
  if (cookie) headers["Cookie"] = cookie;
  if (body && !formData) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ? formData : body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function main() {
  const login = await call("POST", "/auth/login", { username: "admin", password: "admin123" });
  console.log("LOGIN:", login.status);

  const buf = fs.readFileSync("_p0_test_banner.jpg");
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: "image/jpeg" }), "p0-test-banner.jpg");
  fd.append("kind", "hero-slide");
  const up = await call("POST", "/constructor/pages/marketplace-home/media", null, fd);
  console.log("UPLOAD:", up.status, JSON.stringify(up.data).slice(0, 300));
  if (up.status !== 200 && up.status !== 201) return "FAIL_UPLOAD";

  const { url, storageKey, width, height, format, size } = up.data;

  const page = await call("GET", "/constructor/pages/marketplace-home");
  const heroCfg = page.data.heroConfig || { slides: [], carousel: { autoplay: true, interval: 7000, showArrows: true, showIndicators: true } };
  const slides = heroCfg.slides?.length ? heroCfg.slides : [
    { id: "slide-1", imageUrl: "", title: { ru: "P0 Test Slide", az: "P0 Test Slide", en: "P0 Test Slide" }, subtitle: { ru: "", az: "", en: "" }, ctaLabel: { ru: "", az: "", en: "" }, ctaUrl: "/search" },
    { id: "slide-2", imageUrl: "/hero2.png", title: { ru: "", az: "", en: "" }, subtitle: { ru: "", az: "", en: "" }, ctaLabel: { ru: "", az: "", en: "" }, ctaUrl: "/search" },
    { id: "slide-3", imageUrl: "/hero3.png", title: { ru: "", az: "", en: "" }, subtitle: { ru: "", az: "", en: "" }, ctaLabel: { ru: "", az: "", en: "" }, ctaUrl: "/search" },
  ];
  slides[0] = { ...slides[0], imageUrl: url, imageMeta: { width, height, format, size } };
  const saveHero = await call("PUT", "/constructor/pages/marketplace-home/hero", { config: { ...heroCfg, slides } });
  console.log("SAVE HERO:", saveHero.status);

  const sections = page.data.sections.map((s, i) => ({
    blockType: s.blockType, blockInstanceId: s.blockInstanceId, sortOrder: i,
    enabled: s.enabled, settings: s.settings, style: s.style, responsive: s.responsive,
    dataSource: s.dataSource, visibility: s.visibility, localeContent: s.localeContent,
  }));
  await call("PUT", "/constructor/pages/marketplace-home/sections", { sections });
  const pub = await call("POST", "/constructor/pages/marketplace-home/publish");
  console.log("PUBLISH:", pub.status, "currentVersion:", pub.data.currentVersion);

  const published = await call("GET", "/constructor/pages/marketplace-home/published");
  const pubSlide1 = ((published.data.heroConfig || {}).slides || [])[0];
  console.log("PUBLISHED slide-1 image:", pubSlide1?.imageUrl);
  console.log("PUBLISHED slide-1 meta:", JSON.stringify(pubSlide1?.imageMeta));
  console.log("USES UPLOADED URL:", pubSlide1?.imageUrl === url ? "YES" : "NO");

  const mediaRes = await fetch(`http://localhost:4000${url}`, { redirect: "manual" });
  console.log("MEDIA URL STATUS:", mediaRes.status);
  if (mediaRes.status === 302) {
    const signedUrl = mediaRes.headers.get("location");
    console.log("SIGNED URL host:", new URL(signedUrl).host);
    const imgRes = await fetch(signedUrl);
    const ab = await imgRes.arrayBuffer();
    const magic = new Uint8Array(ab.slice(0, 2));
    console.log("SIGNED FETCH:", imgRes.status, imgRes.headers.get("content-type"), ab.byteLength, "bytes");
    console.log("JPEG MAGIC:", magic[0] === 0xff && magic[1] === 0xd8 ? "VALID" : "INVALID");
  }

  console.log("STORAGE_KEY:", storageKey);
  console.log("RESULT:", pubSlide1?.imageUrl === url ? "P0-B E2E PASS" : "P0-B E2E FAIL");
  fs.writeFileSync("_p0_upload_result.txt", JSON.stringify({ url, storageKey, width, height, format, size, publishedImageUrl: pubSlide1?.imageUrl }, null, 2));
}

main().then(() => { setTimeout(() => process.exit(0), 100); }).catch(e => { console.error("FATAL:", e); process.exit(1); });
