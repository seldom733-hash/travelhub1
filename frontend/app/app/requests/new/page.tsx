"use client";

import ManualCreateForm from "@/components/commerce/ManualCreateForm";

/** Ручное создание заявки (MKT-REQ-*) — productId не обязателен. */
export default function NewRequestPage() {
  return <ManualCreateForm mode="request" />;
}
