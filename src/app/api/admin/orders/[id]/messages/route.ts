import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/server-error";
import { actorDisplayName } from "@/lib/admin-data";
import { SALES_ROLES, requireRole } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

const MAX_TEXT = 2000;

/** Проверка существования заказа + авторизации. Возвращает 401/403/404 ответ или null. */
async function guard(request: Request, id: string): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = requireRole(user, SALES_ROLES);
  if (denied) return denied;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }
  return null;
}

/**
 * GET /api/admin/orders/[id]/messages
 * Переписка по заказу (старые → новые, для чата, Гл. 6.9 «Коммуникации»).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const denied = await guard(request, id);
    if (denied) return denied;

    const rows = await prisma.orderMessage.findMany({
      where: { orderId: id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        senderName: true,
        senderRole: true,
        text: true,
        isRead: true,
        createdAt: true,
      },
    });

    const unreadCount = rows.filter(
      (m) => (m.senderRole === "system" || m.senderRole === "manager") && !m.isRead
    ).length;

    return NextResponse.json({
      messages: rows.map((m) => ({
        id: m.id,
        senderName: m.senderName,
        senderRole: m.senderRole,
        text: m.text,
        isRead: m.isRead,
        createdAt: m.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    return serverErrorResponse(error, "Admin order messages GET error");
  }
}

/**
 * POST /api/admin/orders/[id]/messages
 * Отправка сообщения от имени менеджера (senderRole = manager) или клиента (демо-режим).
 * Тело: { text: string, asClient?: boolean }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denied = requireRole(user, SALES_ROLES);
    if (denied) return denied;
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    let body: { text?: unknown; asClient?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Сообщение не может быть пустым" }, { status: 400 });
    }
    if (text.length > MAX_TEXT) {
      return NextResponse.json({ error: `Сообщение длиннее ${MAX_TEXT} символов` }, { status: 400 });
    }
    const asClient = body.asClient === true;

    const message = await prisma.orderMessage.create({
      data: {
        orderId: id,
        senderId: asClient ? null : user.id,
        senderName: asClient ? "Клиент" : actorDisplayName(user),
        senderRole: asClient ? "client" : "manager",
        text,
        isRead: true,
      },
      select: {
        id: true,
        senderName: true,
        senderRole: true,
        text: true,
        isRead: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Сообщение отправлено",
        item: {
          id: message.id,
          senderName: message.senderName,
          senderRole: message.senderRole,
          text: message.text,
          isRead: message.isRead,
          createdAt: message.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return serverErrorResponse(error, "Admin order messages POST error");
  }
}
