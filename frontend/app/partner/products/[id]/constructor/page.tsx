import TourConstructor from "@/components/partner/TourConstructor";

/**
 * PHASE: Partner Tour Builder — полноэкранный конструктор существующего
 * черновика тура (редактирование компонентов/календаря/расчёта).
 */
export default async function TourConstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TourConstructor productId={id} />;
}
