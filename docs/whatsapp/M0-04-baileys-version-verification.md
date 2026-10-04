# M0-04. Версия Baileys: пакет, издатель, совместимость, messageId, LID, supply-chain (D12)

Дата проверки: 2026-10-02. Проверялись **реальные артефакты**: npm registry (`npm view`),
скачанный тарбол пакета (`npm pack @whiskeysockets/baileys@6.7.24` → 362 файла,
1 140 454 байта, распакован и прочитан), и публичные advisory-базы.

## 1. Пакет и издатель (официальность)

```text
npm view @whiskeysockets/baileys dist-tags --json
{ "latest": "7.0.0-rc14", "legacy": "6.7.24" }
```

- **Пакет: `@whiskeysockets/baileys`** — scoped-пакет проекта Baileys.
- **Издатель/проект: WhiskeySockets** (`package.json` → `repository:
  git@github.com:WhiskeySockets/Baileys.git`, `homepage: https://github.com/WhiskeySockets/Baileys/`,
  `license: MIT`, `author: Rajeh Taher` — maintainer из SECURITY.md репозитория).
  Это **не Meta**: Baileys — неофициальная реализация WhatsApp Web протокола (I12/§10 п.13).
- Существует также **не-scoped `baileys`** (его также затрагивает CVE) — в проект берём
  scoped-имя проекта, чтобы не смешивать с одноимёнными клонами; форки/зеркала без аудита
  запрещены (D12).
- Всего в registry 52 версии; линии: `6.7.x` (stable), `6.7.16`-семейство/`6.17.16` (аномалия
  именования), `7.0.0-rc.1…rc14` (RC).

## 2. Выбранная версия (pinned)

**`@whiskeysockets/baileys@6.7.24` — точная версия, без `^`/`~`, lockfile в репо (A16).**

| Вариант | Статус | Вердикт |
|---|---|---|
| `7.0.0-rc14` (`latest`) | release-candidate, breaking changes 7.x | **отклонён**: RC ≠ стабильный, контрактные тесты/механика миграции ещё не проверены проектом |
| `6.7.24` (`legacy`) | стабильная 6.x линия, **новее 6.7.22 (CVE-фикс)** | **принято** |
| `< 6.7.22` | уязвимо CVE-2026-48063 | запрещено |

## 3. Безопасность (advisory)

**CVE-2026-48063** (GHSA-qvv5-jq5g-4cgg, Critical, опубликовано 2026-05-20, CWE-290/345/346):
через `placeholderResendMessage` можно подделать `messages.upsert` (fake key/payload),
испортить history sync и повредить app state sync.
- Затронуто: `< 6.7.22`, `>= 7.0.0-rc.1, < 7.0.0-rc12` (NVD/GitLab Advisory для npm
  `@whiskeysockets/baileys` **и** `baileys`).
- Исправлено в `6.7.22` и `7.0.0-rc12` (fix commit `3beb08ee…`).
→ `6.7.24` ≥ 6.7.22 — фикс присутствует.

**Вредоносные форки (подтверждено источником, не по памяти):** OSV `MAL-2026-17359`,
`MAL-2026-17341` — кампания «PhantomSub» (OX Security): **100+ почти идентичных форков
Baileys на npm** (`@japofc/baileys`, `@badzz88/baileys` и др.) внедряют в socket-слой
тихую подписку на WhatsApp-каналы через аутентифицированную сессию установщика, с
обфускацией целевых JID. → эквивалент D12: брать только пакет издателя проекта, форки —
только после аудита; `npm audit`/dependency-scanning — в CI.

**SECURITY.md WhiskeySockets (рекомендации для downstream):** `baileys_auth_info/` — это
long-lived credential (хранить как SSH-ключ, не в образах, шифровать); дефолтный logger
печатает JIDs и metadata сообщений → в проде `level: 'silent'`/фильтрация (**поддерживает
I7/I8**); «Pin a release — pulling github:… always grabs master» (**поддерживает точный npm-pin**).

## 4. Node / TypeScript / ESM-CJS

Из `package.json` скачанного пакета (6.7.24):

```json
{ "name": "@whiskeysockets/baileys", "version": "6.7.24", "type": "module",
  "main": "lib/index.js", "types": "lib/index.d.ts",
  "engines": { "node": ">=20.0.0" },
  "dependencies": { "libsignal": "git+https://github.com/whiskeysockets/libsignal-node",
                    "pino": "^9.6", "ws": "^8.13.0", "axios": "^1.6.0", "protobufjs": "^7.2.4", … } }
```

- **ESM-only** (`"type":"module"`, `import … from '../WABinary/index.js'` в коде).
  Backend — CommonJS (`backend/tsconfig.json` → `"module": "commonjs"`, `type` не задан).
  **Вывод [A-02]:** подключение — только через dynamic `await import('baileys')` внутри
  `provider/baileys/` (не полагаясь на `require(ESM)`); `moduleResolution` в tsconfig не
  задан (node10-дефолт) → резолв по `main`/`types` работает, `exports`-мапа у пакета нет.
- **Node:** `engines >=20`; `preinstall` скрипт `engine-requirements.js` завершает
  установку на Node < 20. Локально v24.18.0, CI Node 22 (`ci.yml`) — удовлетворяет.
- **TypeScript:** `types: lib/index.d.ts` присутствует; типы (`MessageRelayOptions`,
  `WAMessageKey`, …) читаются без дополнительных `@types`.
- **Скрытая зависимость:** `libsignal` тянется **по git-URL** → `npm ci` требует git в
  CI/сборочном окружении (факт для §6.7/Docker-образа).

## 5. Собственный message id — поддержка (D6, §8 M0 п.4)

**Да, поддерживается в 6.7.24.**

- `lib/Types/Message.d.ts:185-190`:
  `type MinimalRelayOptions = { /** override the message ID with a custom provided string */ messageId?: string; … }` —
  наследуется и `MessageRelayOptions` (`:191`), и **`MiscMessageGenerationOptions` (`:207`)**
  (опции `sendMessage`).
- `lib/Socket/messages-send.js:643-661` — `sendMessage` вызывает
  `generateWAMessage(jid, content, { … messageId: generateMessageIDV2(sock.user?.id), ...options })`:
  **`options` спредится после дефолта** → переданный `messageId` побеждает.
- `:696-697` — `relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, … })`;
  в `relayMessage` (`:254`, `:263`): `msgId = msgId || generateMessageIDV2(…)`.
- Формат id: `generateMessageID()` = `'3EB0' + hex` (`lib/Utils/generics.js:160`).

**Следствие (D6):** id генерируется заранее, сохраняется в
`whatsapp.WhatsAppOutboundMessage.providerMessageId` **до** `send()` → `Reconcile`
реален (echo/receipt с этим ID доказывает фактическую отправку). Автоповтор `UNKNOWN`
всё равно запрещён (at-most-once).

## 6. Поведение LID (D3, §8 M0 п.4)

- `lib/WABinary/jid-utils.js:33` — `isLidUser = (jid) => jid?.endsWith('@lid')`.
- `lib/Types/Message.d.ts:16-21` — `WAMessageKey` несёт **одновременно**
  `senderLid`/`participantLid` **и** `senderPn`/`participantPn` → пара (LID ↔ телефон)
  доступна из поля самого сообщения, когда WhatsApp её прислал.
- `lib/Types/Contact.d.ts:2-5` — `id` «either in lid or jid format», поле `lid?`;
  `lib/Types/Events.d.ts:32-33` — объект `me` содержит `lid` и `jid`; у групп —
  `addressingMode: 'pn' | 'lid'` (`GroupMetadata.d.ts:13`); `decodeMessageNode(stanza, meId, meLid)`.
- `lib/Utils/decode-wa-message.js:36` — декодер принимает и `isJidUser`, и `isLidUser`
  отправителей; `messages-recv.js:765` — LID-specific ветки (`relaylatency`).
- **Публичного резолвера LID→phone в 6.7.24 нет** (grep `lidMapping|lidTo|getLid` по
  типам пакета → 0).

**Следствие (D3):** телефон берём из `senderPn/participantPn` либо из `@s.whatsapp.net`;
если адресация только LID → контакт `unmatched` с пометкой, ручная привязка оператором.
Никогда не выводим номер «наугад». Dedup-ключ (D7) нормализуется через contact-слой,
чтобы повтор с другой адресацией не создал дубль (A14).

## 7. Проверенные команды (выводы)

```text
> npm view @whiskeysockets/baileys dist-tags --json
{ "latest": "7.0.0-rc14", "legacy": "6.7.24" }

> npm view @whiskeysockets/baileys@6.7.24 engines --json      → { "node": ">=20.0.0" }
> npm view @whiskeysockets/baileys versions --json            → total 52; 6.x tail: … 6.7.22, 6.7.23, 6.7.24 …

> npm pack @whiskeysockets/baileys@6.7.24
npm notice total files: 362
TGZ=whiskeysockets-baileys-6.7.24.tgz size=1140454

(извлечено из тарбола) package.json → "type":"module", "license":"MIT",
"repository":"git@github.com/WhiskeySockets/Baileys.git", engines.node >=20.0.0,
dependency libsignal = git+https://github.com/whiskeysockets/libsignal-node

grep по lib/**/*.d.ts → messageId?: string (Message.d.ts:187); isLidUser (jid-utils);
WAMessageKey.senderPn/senderLid/participantPn/participantLid
```

**Не проверено в M0 / ограничения:** реальный скан QR и живое соединение (нужен телефон,
ручной smoke — H1/H2, агент выполнить не может); поведение LID на живом аккаунте
(проверяется в M3 smoke); `npm audit` по дереву проекта после установки (M1, и добавить шаг в CI).
