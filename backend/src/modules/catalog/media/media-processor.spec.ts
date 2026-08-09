import { detectImageFormat } from "./media-processor.service";

describe("detectImageFormat (magic bytes)", () => {
  it("определяет JPEG по сигнатуре FF D8 FF", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectImageFormat(buf)).toBe("jpeg");
  });

  it("определяет PNG по сигнатуре 89 50 4E 47...", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectImageFormat(buf)).toBe("png");
  });

  it("определяет WebP по RIFF....WEBP", () => {
    const buf = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "latin1"),
      Buffer.from("VP8 ", "latin1"),
    ]);
    expect(detectImageFormat(buf)).toBe("webp");
  });

  it("возвращает null для не-JPEG/PNG/WebP (например, GIF или текст)", () => {
    expect(detectImageFormat(Buffer.from("GIF89a...."))).toBeNull();
    expect(detectImageFormat(Buffer.from("plain text content"))).toBeNull();
    expect(detectImageFormat(Buffer.alloc(4))).toBeNull();
  });
});
