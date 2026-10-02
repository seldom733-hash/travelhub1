/**
 * Dev-only патч Next.js 16.2.12 devtools (segment explorer).
 *
 * Баг: в trie сегмент-эксплорера (next-devtools) узел может оказаться без
 * `children` (при повторном монтаже boundary/page сегментов), после чего
 * `insert` падает с `TypeError: Cannot read properties of undefined
 * (reading 'page.tsx')` и дев-оверлей заменяет страницу на
 * "This page couldn't load" — воспроизводится на маршрутах конструктора туров
 * (/partner/products/new/constructor и [id]/constructor).
 *
 * Фикс: перед обращением к `o.children[r]` инициализируем `o.children`, если он
 * отсутствует. Изменение затрагивает только dev-инструменты, не рантайм приложения.
 *
 * Запускается автоматически через postinstall (см. package.json).
 * Идемпотентно: повторный запуск ничего не меняет.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ORIGINAL =
  "for(let r of e(t))o.children[r]||(o.children[r]={value:void 0,children:{}}),o=o.children[r]";
const PATCHED =
  "for(let r of e(t)){o.children||(o.children={}),o.children[r]||(o.children[r]={value:void 0,children:{}}),o=o.children[r]}";

const file = require.resolve("next/dist/compiled/next-devtools/index.js");

if (!existsSync(file)) {
  console.error(`[patch-next-devtools] file not found: ${file} — skipping`);
  process.exit(0);
}

const src = readFileSync(file, "utf8");

if (src.includes(PATCHED)) {
  console.log("[patch-next-devtools] already patched — skipping");
  process.exit(0);
}

if (!src.includes(ORIGINAL)) {
  console.error(
    "[patch-next-devtools] target code not found (Next.js version changed?) — skipping",
  );
  process.exit(0);
}

writeFileSync(file, src.replace(ORIGINAL, PATCHED));
console.log("[patch-next-devtools] patched", file);
