import { BadRequestException, Body, Controller, Headers, Post, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { Public } from "../../security/auth/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentService } from "./payment.service";

type WebhookBody = { eventId?: string; paymentCode?: string; status?: string };

@Controller("public/payments")
export class PaymentWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
  ) {}

  @Public()
  @Post("webhook")
  async webhook(@Body() body: WebhookBody, @Headers("x-webhook-signature") signature?: string) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new ServiceUnavailableException("Webhook secret is not configured");
    if (!signature) throw new UnauthorizedException("Missing signature");
    const expected = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException("Invalid signature");

    const eventId = body.eventId?.trim();
    const paymentCode = body.paymentCode?.trim();
    const status = body.status?.trim().toUpperCase();
    if (!eventId || !paymentCode || !status) throw new BadRequestException("eventId, paymentCode and status are required");
    if (!["CAPTURED", "FAILED", "CANCELLED"].includes(status)) throw new BadRequestException("Unsupported status");

    try {
      await this.prisma.paymentWebhookEvent.create({
        data: { eventId, provider: "generic", payload: body as object },
      });
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
        return { received: true, duplicate: true, eventId };
      }
      throw e;
    }

    const actorUser = await this.prisma.user.findFirst({ where: { username: "admin" }, select: { id: true } });
    if (!actorUser) throw new ServiceUnavailableException("Webhook system actor is not configured");
    const actor = { id: actorUser.id, username: "webhook" };
    const payment = await this.prisma.payment.findUnique({ where: { code: paymentCode }, select: { id: true } });
    if (!payment) throw new BadRequestException(`Payment ${paymentCode} not found`);
    if (status === "CAPTURED") await this.payments.confirmPayment(paymentCode, actor);
    if (status === "FAILED") await this.payments.failPayment(paymentCode, actor);
    if (status === "CANCELLED") await this.payments.cancelPayment(paymentCode, actor);
    return { received: true, duplicate: false, eventId };
  }
}
