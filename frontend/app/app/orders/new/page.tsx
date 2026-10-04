"use client";

import ManualCreateForm from "@/components/commerce/ManualCreateForm";

/** Ручное создание заказа (MKT-ORD-*) — canonical цепочка заявка → заказ. */
export default function NewOrderPage() {
  return <ManualCreateForm mode="order" />;
}
