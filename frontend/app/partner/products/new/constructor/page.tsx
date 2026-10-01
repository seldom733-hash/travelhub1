import TourConstructor from "@/components/partner/TourConstructor";

/**
 * PHASE: Partner Tour Builder — полноэкранный конструктор (новый черновик).
 * Черновик Product создаётся при первом сохранении шага 1; после этого
 * URL заменяется на /partner/products/[id]/constructor.
 */
export default function NewTourConstructorPage() {
  return <TourConstructor productId={null} />;
}
