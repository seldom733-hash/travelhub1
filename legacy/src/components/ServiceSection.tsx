import ServiceCard, { ServiceCardData } from "./ServiceCard";

interface Props {
  title: string;
  badge: string;
  href: string;
  typeLabel: string;
  services: ServiceCardData[];
  bg?: "white" | "gray";
}

export default function ServiceSection({ title, badge, href, typeLabel, services, bg = "white" }: Props) {
  if (!services.length) return null;
  return (
    <section className={`${bg === "gray" ? "bg-gray-50/70" : ""} py-12`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">{badge}</p>
            <h2 className="text-3xl font-extrabold text-secondary">{title}</h2>
          </div>
          <a href={href} className="shrink-0 text-sm font-semibold text-primary hover:text-primary-dark">
            Все {typeLabel} →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {services.map((s) => (
            <ServiceCard key={s.id} s={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
