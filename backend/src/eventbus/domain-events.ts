/**
 * Event Catalog (Phase 1) — канонические типы событий и контракты payload.
 *
 * Издатели:
 *   Catalog: ProductCreated, ProductPublished, ProductArchived
 *   CRM:     CustomerCreated, CustomerUpdated
 *   Order:   OrderCreated, OrderApproved, OrderCancelled, BookingRequested
 *   Booking: BookingCreated, BookingConfirmed, BookingRejected, BookingCancelled
 *
 * Подписчики:
 *   Order   ← BookingConfirmed, BookingRejected (агрегированное состояние)
 *   Booking ← BookingRequested (создание Booking + Passenger)
 *
 * Order НИКОГДА не пишет в таблицы Booking и наоборот — только события + чтение.
 */
export const DomainEvents = {
  // Catalog
  ProductCreated: "ProductCreated",
  ProductPublished: "ProductPublished",
  ProductArchived: "ProductArchived",
  // CRM
  CustomerCreated: "CustomerCreated",
  CustomerUpdated: "CustomerUpdated",
  // Order
  OrderCreated: "OrderCreated",
  OrderApproved: "OrderApproved",
  OrderCancelled: "OrderCancelled",
  OrderStatusChanged: "OrderStatusChanged",
  BookingRequested: "BookingRequested",
  // Booking
  BookingCreated: "BookingCreated",
  BookingConfirmed: "BookingConfirmed",
  BookingRejected: "BookingRejected",
  BookingCancelled: "BookingCancelled",
  BookingStatusChanged: "BookingStatusChanged",
} as const;

export type DomainEventType = (typeof DomainEvents)[keyof typeof DomainEvents];

// ── Payload-контракты ────────────────────────────────────────────────────────

export interface ProductEventPayload {
  productId: string;
  code: string;
  title: string;
  type: string;
}

export interface CustomerEventPayload {
  customerId: string;
  code: string;
  name: string;
  email: string;
  changedFields?: string[];
}

export interface OrderEventPayload {
  orderId: string;
  code: string;
  number: string;
  customerId: string;
  amount: string;
  currency: string;
}

export interface OrderApprovedPayload {
  orderId: string;
  code: string;
  customerId: string;
}

export interface OrderItemRef {
  productId: string;
  productCode: string;
  title: string;
  quantity: number;
  serviceDate?: string | null;
}

export interface OrderTravelerRef {
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  citizenship?: string | null;
  gender?: string | null;
  passportNumber?: string | null;
}

export interface BookingRequestedPayload {
  orderId: string;
  orderCode: string;
  customerId: string;
  items: OrderItemRef[];
  travelers: OrderTravelerRef[];
}

export interface BookingEventPayload {
  bookingId: string;
  code: string;
  orderId: string;
  productId: string;
  reason?: string;
}

export interface StatusChangedPayload {
  from: string;
  to: string;
  reason?: string;
  actor?: string;
}
