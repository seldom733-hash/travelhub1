import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";
import { WhatsAppMediaStorage, extensionForMime, sanitizeFilename } from "./whatsapp-media.storage";

describe("sanitizeFilename (M3+)", () => {
  it("убирает пути и спецсимволы, сохраняет расширение", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\temp\\report.pdf")).toBe("report.pdf");
    expect(sanitizeFilename('a<b>c:d"e|f?g*h.txt')).toBe("a_b_c_d_e_f_g_h.txt");
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("..")).toBe("file");
    expect(sanitizeFilename(".")).toBe("file");
  });

  it("длинное имя усекается до 120 символов с расширением", () => {
    const name = sanitizeFilename(`${"x".repeat(300)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("WhatsAppMediaStorage", () => {
  let dir: string;

  beforeEach(async () => {
    dir = path.join(os.tmpdir(), `wa-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(async () => {
    await fsp.rm(dir, { recursive: true, force: true });
  });

  const UPLOAD_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("stageUpload → readUpload roundtrip (байты, мета; meta.json переживает реконструкцию)", async () => {
    const storage = new WhatsAppMediaStorage(dir);
    const meta = await storage.stageUpload(
      { originalname: "отчёт.pdf", mimetype: "application/pdf", size: 4, bytes: new Uint8Array([9, 8, 7, 6]) },
      UPLOAD_ID,
    );
    expect(meta).toEqual({
      uploadId: UPLOAD_ID,
      filename: "отчёт.pdf",
      mimetype: "application/pdf",
      size: 4,
    });

    const staged = await storage.readUpload(UPLOAD_ID);
    expect(staged).toMatchObject({ filename: "отчёт.pdf", mimetype: "application/pdf", size: 4 });
    expect(Array.from(staged!.bytes)).toEqual([9, 8, 7, 6]);

    await expect(storage.readUpload("00000000-0000-0000-0000-000000000000")).resolves.toBeNull();
  });

  it("невалидный uploadId → ошибка (не путь в ФС)", async () => {
    const storage = new WhatsAppMediaStorage(dir);
    expect(() => storage.assertUploadId("../../evil")).toThrow("invalid upload id");
    await expect(storage.readUpload("..%2F..")).rejects.toThrow("invalid upload id");
  });

  it("adoptUpload: файл переезжает в outbound/<ownerId>, uploads/<id> удаляется, путь относительный", async () => {
    const storage = new WhatsAppMediaStorage(dir);
    await storage.stageUpload(
      { originalname: "a.txt", mimetype: "text/plain", size: 3, bytes: new Uint8Array([1, 2, 3]) },
      UPLOAD_ID,
    );

    const adopted = await storage.adoptUpload(UPLOAD_ID, "3EB0ABCDEF");
    expect(adopted).toEqual({
      filename: "a.txt",
      mimetype: "text/plain",
      size: 3,
      relativePath: path.posix.join("outbound", "3EB0ABCDEF", "a.txt"),
    });
    await expect(fsp.access(path.join(dir, adopted!.relativePath))).resolves.toBeUndefined();
    await expect(fsp.access(path.join(dir, "uploads", UPLOAD_ID))).rejects.toThrow();
    await expect(storage.readUpload(UPLOAD_ID)).resolves.toBeNull();

    const bytes = await storage.readRelative(adopted!.relativePath);
    expect(Array.from(bytes!)).toEqual([1, 2, 3]);
  });

  it("saveInbound: файл inbound/<id>/<имя>, путь относительный; без байт → null", async () => {
    const storage = new WhatsAppMediaStorage(dir);
    const saved = await storage.saveInbound("3EB0MSGID", {
      filename: "photo.jpeg",
      mimetype: "image/jpeg",
      size: 2,
      bytes: new Uint8Array([4, 5]),
    });
    expect(saved).toEqual({
      filename: "photo.jpeg",
      mimetype: "image/jpeg",
      size: 2,
      relativePath: path.posix.join("inbound", "3EB0MSGID", "photo.jpeg"),
    });
    const bytes = await storage.readRelative(saved!.relativePath);
    expect(Array.from(bytes!)).toEqual([4, 5]);

    await expect(
      storage.saveInbound("3EB0EMPTY", { filename: null, mimetype: null, size: 0, bytes: new Uint8Array(0) }),
    ).resolves.toBeNull();
  });

  it("saveInbound: без stanza-имени синтезирует имя из mimetype+type (M5: голосовое без расширения)", async () => {
    const storage = new WhatsAppMediaStorage(dir);

    const voice = await storage.saveInbound("3EB0VOICE", {
      filename: null,
      mimetype: "audio/ogg; codecs=opus",
      size: 3,
      type: "audio",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(voice).toMatchObject({
      filename: "voice.ogg",
      relativePath: path.posix.join("inbound", "3EB0VOICE", "voice.ogg"),
    });
    expect(Array.from((await storage.readRelative(voice!.relativePath))!)).toEqual([1, 2, 3]);

    const image = await storage.saveInbound("3EB0IMG", {
      filename: null,
      mimetype: "image/jpeg",
      size: 1,
      type: "image",
      bytes: new Uint8Array([9]),
    });
    expect(image!.filename).toBe("image.jpg");

    const namedNoExt = await storage.saveInbound("3EB0DOC", {
      filename: "report",
      mimetype: "application/pdf",
      size: 1,
      type: "document",
      bytes: new Uint8Array([9]),
    });
    expect(namedNoExt!.filename).toBe("report.pdf");

    const namedWithExt = await storage.saveInbound("3EB0DOC2", {
      filename: "report.pdf",
      mimetype: "application/pdf",
      size: 1,
      type: "document",
      bytes: new Uint8Array([9]),
    });
    expect(namedWithExt!.filename).toBe("report.pdf");

    const unknown = await storage.saveInbound("3EB0UNK", {
      filename: null,
      mimetype: "application/x-weird",
      size: 1,
      type: "document",
      bytes: new Uint8Array([9]),
    });
    expect(unknown!.filename).toBe("file");
  });

  it("extensionForMime: параметры/регистр отбрасываются, неизвестный → null", () => {
    expect(extensionForMime("audio/ogg; codecs=opus")).toBe("ogg");
    expect(extensionForMime("AUDIO/MPEG")).toBe("mp3");
    expect(extensionForMime("image/svg+xml")).toBe("svg");
    expect(extensionForMime("application/x-weird")).toBeNull();
    expect(extensionForMime(null)).toBeNull();
    expect(extensionForMime("garbage")).toBeNull();
  });

  it("readRelative: traversal/absolute пути отклоняются (выход за rootDir)", async () => {
    const storage = new WhatsAppMediaStorage(dir);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, "ok.txt"), "ok");

    expect((await storage.readRelative("ok.txt"))?.toString()).toBe("ok");
    await expect(storage.readRelative("../outside.txt")).resolves.toBeNull();
    await expect(storage.readRelative("a/../../outside.txt")).resolves.toBeNull();
    await expect(storage.readRelative(path.join(dir, "ok.txt"))).resolves.toBeNull(); // absolute
    await expect(storage.readRelative("")).resolves.toBeNull();
  });
});
