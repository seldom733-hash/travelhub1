// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WhatsappInboxPage from "./page";
import type { WhatsAppConversationDetail, WhatsAppConversationRow, WhatsAppTimelineItem } from "@/lib/whatsapp";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  auth: { token: null },
}));

vi.mock("@/lib/use-can", () => ({ useCan: () => true }));

import { api } from "@/lib/api";

const getMock = api.get as ReturnType<typeof vi.fn>;
const postMock = api.post as ReturnType<typeof vi.fn>;

function row(overrides: Partial<WhatsAppConversationRow> = {}): WhatsAppConversationRow {
  return {
    id: "conv-1",
    accountId: null,
    remoteJid: "994501112233@s.whatsapp.net",
    canonicalPhone: "+994501112233",
    matchingStatus: "MATCHED",
    customerId: null,
    lastMessageAt: "2026-10-04T10:00:00.000Z",
    lastMessagePreview: "voice.ogg",
    lastReadAt: null,
    unreadCount: 0,
    suppressed: false,
    createdAt: "2026-10-04T09:00:00.000Z",
    updatedAt: "2026-10-04T10:00:00.000Z",
    ...overrides,
  };
}

function detail(overrides: Partial<WhatsAppConversationDetail> = {}): WhatsAppConversationDetail {
  return {
    ...row(),
    customer: null,
    candidates: [],
    context: null,
    ...overrides,
  };
}

function item(overrides: Partial<WhatsAppTimelineItem> = {}): WhatsAppTimelineItem {
  return {
    id: "msg-1",
    origin: "inbound",
    direction: "INBOUND",
    body: null,
    messageType: "text",
    occurredAt: "2026-10-04T10:00:00.000Z",
    communicationCode: null,
    providerMessageId: null,
    mediaFilename: null,
    mediaMime: null,
    mediaSize: null,
    hasMedia: false,
    status: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    ...overrides,
  };
}

function mockRoutes(
  timeline: WhatsAppTimelineItem[],
  rows: WhatsAppConversationRow[] = [row()],
  selected: WhatsAppConversationDetail = detail(),
): void {
  getMock.mockImplementation((url: string) => {
    if (url.startsWith("/whatsapp/conversations/")) {
      if (url.endsWith("/messages")) return Promise.resolve(timeline);
      return Promise.resolve(selected);
    }
    if (url.startsWith("/whatsapp/conversations")) return Promise.resolve(rows);
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  postMock.mockResolvedValue(undefined);
});

describe("WhatsappInboxPage — M5 вложения (аудио-плеер)", () => {
  it("аудио → <audio controls> со ссылкой на медиа; документ → ссылка-скачивание с именем", async () => {
    mockRoutes([
      item({
        id: "in-audio",
        messageType: "audio",
        mediaFilename: "voice.ogg",
        mediaMime: "audio/ogg; codecs=opus",
        mediaSize: 512,
        hasMedia: true,
      }),
      item({
        id: "in-doc",
        messageType: "document",
        body: "вот файл",
        mediaFilename: "report.pdf",
        mediaMime: "application/pdf",
        mediaSize: 2048,
        hasMedia: true,
      }),
    ]);

    render(<WhatsappInboxPage />);
    const rowButton = await screen.findByText("+994501112233");
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/whatsapp/conversations"));

    rowButton.closest("button")!.click();

    const player = await screen.findByTestId<HTMLAudioElement>("audio-player");
    expect(player.tagName).toBe("AUDIO");
    expect(player.getAttribute("controls")).not.toBeNull();
    expect(player.getAttribute("src")).toBe("/api/v1/whatsapp/media/inbound/in-audio");

    const docLink = screen.getByText("report.pdf").closest("a")!;
    expect(docLink.getAttribute("download")).not.toBeNull();
    expect(docLink.getAttribute("href")).toBe("/api/v1/whatsapp/media/inbound/in-doc");
  });

  it("аудио-сообщение НЕ рендерит ссылку-скачивание (только плеер)", async () => {
    mockRoutes([
      item({
        id: "in-audio-2",
        messageType: "audio",
        mediaFilename: "voice.ogg",
        mediaMime: "audio/ogg; codecs=opus",
        mediaSize: 512,
        hasMedia: true,
      }),
    ]);

    render(<WhatsappInboxPage />);
    (await screen.findByText("+994501112233")).closest("button")!.click();

    await screen.findByTestId("audio-player");
    // Превью списка (кнопка) может содержать имя файла — ссылки-скачивания не должно.
    expect(screen.queryByRole("link", { name: /voice\.ogg/ })).toBeNull();
  });

  it("LID-адресация: диалог без разрешённого номера показывает lid-адрес (§10)", async () => {
    const LID = "157848755548268@lid";
    const lidRow = row({
      id: "conv-lid",
      remoteJid: LID,
      canonicalPhone: null,
      matchingStatus: "UNMATCHED",
    });
    mockRoutes(
      [],
      [lidRow],
      detail({ id: "conv-lid", remoteJid: LID, canonicalPhone: null, matchingStatus: "UNMATCHED" }),
    );

    render(<WhatsappInboxPage />);

    // Список: вместо «Номер не определён» — сам lid-адрес.
    const label = await screen.findByText(LID);
    expect(screen.queryByText("Номер не определён")).toBeNull();

    // Заголовок выбранного диалога — тоже lid (отправка идёт по нему же).
    label.closest("button")!.click();
    await waitFor(() => expect(getMock).toHaveBeenCalledWith(`/whatsapp/conversations/conv-lid`));
    expect((await screen.findAllByText(LID)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("WhatsappInboxPage — §10 «Привязать Lid к номеру»", () => {
  const LID = "157848755548268@lid";

  it("lid-диалог → кнопка/поле ввода; после ОК POST /phone и номер вместо lid", async () => {
    mockRoutes(
      [],
      [row({ id: "conv-lid", remoteJid: LID, canonicalPhone: null, matchingStatus: "UNMATCHED" })],
      detail({ id: "conv-lid", remoteJid: LID, canonicalPhone: null, matchingStatus: "UNMATCHED" }),
    );
    postMock.mockResolvedValue(
      detail({
        id: "conv-lid",
        remoteJid: LID,
        canonicalPhone: "+994509998877",
        matchingStatus: "UNMATCHED",
      }),
    );

    render(<WhatsappInboxPage />);
    const label = await screen.findByText(LID);
    label.closest("button")!.click();

    // Кнопка бинда присутствует (номер не разрешён, jid = @lid).
    const bindBtn = await screen.findByRole("button", { name: "Привязать Lid к номеру" });
    bindBtn.click();

    const input = await screen.findByPlaceholderText(/Номер собеседника/);
    const okBtn = screen.getByRole("button", { name: "ОК" });
    expect(okBtn.hasAttribute("disabled")).toBe(true);

    // @testing-library fireEvent: React onChange не срабатывает от .value.
    fireEvent.change(input, { target: { value: "+994509998877" } });
    expect(screen.getByRole("button", { name: "ОК" }).hasAttribute("disabled")).toBe(false);
    screen.getByRole("button", { name: "ОК" }).click();

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/whatsapp/conversations/conv-lid/phone", {
        phone: "+994509998877",
      }),
    );
    // Detail обновлён: в заголовке — номер, lid-кнопка скрыта.
    expect(await screen.findByText("+994509998877")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Привязать Lid к номеру" })).toBeNull();
  });

  it("ошибка бинда (409) показывается в панели, поле остаётся открытым", async () => {
    mockRoutes(
      [],
      [row({ id: "conv-lid2", remoteJid: LID, canonicalPhone: null, matchingStatus: "UNMATCHED" })],
      detail({ id: "conv-lid2", remoteJid: LID, canonicalPhone: null, matchingStatus: "UNMATCHED" }),
    );
    postMock.mockRejectedValue(new Error("Phone number is already bound to another conversation"));

    render(<WhatsappInboxPage />);
    (await screen.findByText(LID)).closest("button")!.click();
    (await screen.findByRole("button", { name: "Привязать Lid к номеру" })).click();

    fireEvent.change(await screen.findByPlaceholderText(/Номер собеседника/), {
      target: { value: "abc" },
    });
    screen.getByRole("button", { name: "ОК" }).click();

    await screen.findByText("Phone number is already bound to another conversation");
    expect(screen.getByPlaceholderText(/Номер собеседника/)).toBeTruthy();
    expect(postMock).toHaveBeenCalledWith("/whatsapp/conversations/conv-lid2/phone", { phone: "abc" });
  });
});
