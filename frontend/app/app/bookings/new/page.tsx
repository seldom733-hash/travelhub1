"use client";

import ManualCreateForm from "@/components/commerce/ManualCreateForm";

/** Ручное создание бронирования (MKT-BKG-*) — canonical цепочка заявка → заказ → бронь. */
export default function NewBookingPage() {
  return <ManualCreateForm mode="booking" />;
}
