import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { AuthStateStore, WhatsAppAuthStateError } from "./auth-state-store";

const KEY = "0123456789abcdef0123456789abcdef"; // 32 chars

describe("AuthStateStore (M2)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), "wa-auth-"));
  });

  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true });
  });

  const newStore = (key = KEY, fileName?: string): AuthStateStore =>
    new AuthStateStore({ sessionPath: dir, encryptionKeyMaterial: key, fileName });

  it("fail-closed: отсутствующий/короткий ключ → ошибка, хранилище не создаётся", () => {
    expect(() => newStore("")).toThrow(WhatsAppAuthStateError);
    expect(() => newStore("   ")).toThrow(WhatsAppAuthStateError);
    try {
      newStore("short");
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as WhatsAppAuthStateError).code).toBe("key_too_short");
    }
  });

  it("save → load: roundtrip creds/keys/fencingToken; файла не было → null", async () => {
    const store = newStore();
    expect(await store.load()).toBeNull();
    await store.save({ creds: { me: { id: "x" } }, keys: { prekey: { a: 1 } } }, 1);
    const doc = await newStore().load();
    expect(doc).not.toBeNull();
    expect(doc?.creds).toEqual({ me: { id: "x" } });
    expect(doc?.keys).toEqual({ prekey: { a: 1 } });
    expect(doc?.fencingToken).toBe(1);
    expect(newStore().persistedFencingToken).toBe(0);
  });

  it("содержимое на диске не содержит открытого текста (encrypted at rest)", async () => {
    const store = newStore();
    await store.save({ creds: { marker: "PLAINTEXT-MARKER-XYZ" }, keys: {} }, 1);
    const raw = await fsp.readFile(store.filePath, "utf8");
    expect(raw).not.toContain("PLAINTEXT-MARKER-XYZ");
    expect(JSON.parse(raw).v).toBe(1);
  });

  it("повреждённый файл → corrupt; файл НЕ удаляется и НЕ сбрасывается автоматически", async () => {
    const store = newStore();
    await store.save({ creds: {}, keys: {} }, 1);
    await fsp.writeFile(store.filePath, "{ definitely not json", "utf8");
    const failure = await newStore().load().then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(WhatsAppAuthStateError);
    expect((failure as WhatsAppAuthStateError).code).toBe("corrupt");
    // Файл на месте — авто-сброса/удаления не произошло.
    await expect(fsp.readFile(store.filePath, "utf8")).resolves.toBeDefined();
  });

  it("битый ciphertext (бит в data) → integrity, не corrupt", async () => {
    const store = newStore();
    await store.save({ creds: {}, keys: {} }, 1);
    const envelope = JSON.parse(await fsp.readFile(store.filePath, "utf8"));
    const bytes = Buffer.from(envelope.data, "base64");
    bytes[0] ^= 0xff;
    envelope.data = bytes.toString("base64");
    await fsp.writeFile(store.filePath, JSON.stringify(envelope), "utf8");
    const failure = await newStore().load().then(() => null, (error: unknown) => error);
    expect((failure as WhatsAppAuthStateError).code).toBe("integrity");
  });

  it("смена ключа → key_mismatch (не трактуется как порча)", async () => {
    const store = newStore();
    await store.save({ creds: {}, keys: {} }, 1);
    const otherKey = "fedcba9876543210fedcba9876543210";
    const failure = await newStore(otherKey).load().then(() => null, (error: unknown) => error);
    expect((failure as WhatsAppAuthStateError).code).toBe("key_mismatch");
  });

  it("fencing: запись токеном старее дискового → stale_fencing_token, файл не меняется", async () => {
    const owner = newStore();
    await owner.save({ creds: { owner: "B" }, keys: {} }, 2);
    const zombie = newStore();
    expect(await zombie.load()).not.toBeNull();
    const failure = await zombie
      .save({ creds: { owner: "A-zombie" }, keys: {} }, 1)
      .then(() => null, (error: unknown) => error);
    expect((failure as WhatsAppAuthStateError).code).toBe("stale_fencing_token");
    const doc = await newStore().load();
    expect(doc?.creds).toEqual({ owner: "B" });
    expect(doc?.fencingToken).toBe(2);
  });

  it("writer queue: конкурентные save сериализуются, последняя запись выигрывает", async () => {
    const store = newStore();
    await Promise.all([
      store.save({ creds: { n: 1 }, keys: {} }, 1),
      store.save({ creds: { n: 2 }, keys: {} }, 2),
      store.save({ creds: { n: 3 }, keys: {} }, 3),
    ]);
    const doc = await newStore().load();
    expect(doc?.creds).toEqual({ n: 3 });
    expect(doc?.fencingToken).toBe(3);
    // После успешных записей .tmp не остаётся.
    const files = await fsp.readdir(dir);
    expect(files.filter((name) => name.includes(".tmp"))).toEqual([]);
  });

  it("leftover .tmp (crash) не мешает load; следующая save его заменяет", async () => {
    const store = newStore();
    await store.save({ creds: { a: 1 }, keys: {} }, 1);
    await fsp.writeFile(`${store.filePath}.tmp`, "partial garbage", "utf8");
    const doc = await newStore().load();
    expect(doc?.creds).toEqual({ a: 1 });
    await newStore().save({ creds: { a: 2 }, keys: {} }, 2);
    const files = await fsp.readdir(dir);
    expect(files.filter((name) => name.includes(".tmp"))).toEqual([]);
    expect((await newStore().load())?.creds).toEqual({ a: 2 });
  });

  it("wipe: удаляет файл явно; после wipe load → null; wipe токеном старее памяти → отказ", async () => {
    const store = newStore();
    await store.save({ creds: {}, keys: {} }, 5);
    const loaded = newStore();
    await loaded.load();
    const failure = await loaded.wipe(4).then(() => null, (error: unknown) => error);
    expect((failure as WhatsAppAuthStateError).code).toBe("stale_fencing_token");
    await loaded.wipe(6);
    expect(await newStore().load()).toBeNull();
  });

  it("wipe позволяет удалить ПОВРЕЖДЁННЫЙ файл (явный ручной reset)", async () => {
    const store = newStore();
    await store.save({ creds: {}, keys: {} }, 1);
    await fsp.writeFile(store.filePath, "garbage", "utf8");
    const manual = newStore();
    await manual.wipe(2);
    expect(await newStore().load()).toBeNull();
  });
});
