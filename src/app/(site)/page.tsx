import { prisma } from "@/lib/prisma";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import PopularDestinations from "@/components/PopularDestinations";
import HotTours from "@/components/HotTours";
import ServiceSection from "@/components/ServiceSection";
import FlightsSection from "@/components/FlightsSection";
import GuidesSection from "@/components/GuidesSection";
import PhotographersSection from "@/components/PhotographersSection";
import TransfersSection from "@/components/TransfersSection";
import WhyTravelHub from "@/components/WhyTravelHub";
import ForPartners from "@/components/ForPartners";

const SERVICE_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  price: true,
  discountPrice: true,
  currency: true,
  city: true,
  country: true,
  countryCode: true,
  rating: true,
  reviewCount: true,
  images: true,
  duration: true,
  isHot: true,
  hotDiscount: true,
  languages: true,
  maxGuests: true,
} as const;

export default async function Home() {
  // Параллельно тянем выборки для секций главной
  const [tours, hotels, excursions, sanatoriums, hotTours, flights, guides, photographers, transfers] = await Promise.all([
    prisma.service.findMany({
      where: { type: "TOUR", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 8,
    }),
    prisma.service.findMany({
      where: { type: "HOTEL", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 8,
    }),
    prisma.service.findMany({
      where: { type: "EXCURSION", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 8,
    }),
    prisma.service.findMany({
      where: { type: "SANATORIUM", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 4,
    }),
    prisma.service.findMany({
      where: { type: "TOUR", isActive: true, isHot: true },
      select: SERVICE_SELECT,
      orderBy: { hotDiscount: "desc" },
      take: 4,
    }),
    prisma.service.findMany({
      where: { type: "FLIGHT", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 5,
    }),
    prisma.service.findMany({
      where: { type: "GUIDE", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 4,
    }),
    prisma.service.findMany({
      where: { type: "PHOTOGRAPHER", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 4,
    }),
    prisma.service.findMany({
      where: { type: "TRANSFER", isActive: true },
      select: SERVICE_SELECT,
      orderBy: { reviewCount: "desc" },
      take: 4,
    }),
  ]);

  return (
    <main>
      <Hero />
      <Categories />
      <PopularDestinations />
      <HotTours />
      <ServiceSection title="Горящие туры" badge="🔥 Акции" href="/search?type=TOUR&hot=1" typeLabel="туры" services={hotTours} />
      <ServiceSection title="Туры" badge="🏖 Каталог" href="/tours" typeLabel="туры" services={tours} />
      <ServiceSection title="Отели" badge="🏨 Размещение" href="/hotels" typeLabel="отели" services={hotels} bg="gray" />
      <ServiceSection title="Экскурсии" badge="🏛 Впечатления" href="/excursions" typeLabel="экскурсии" services={excursions} />
      <ServiceSection title="Санатории" badge="🏥 Здоровье" href="/sanatoriums" typeLabel="санатории" services={sanatoriums} bg="gray" />
      <FlightsSection flights={flights} />
      <GuidesSection guides={guides} />
      <PhotographersSection photographers={photographers} />
      <TransfersSection transfers={transfers} />
      <WhyTravelHub />
      <ForPartners />
    </main>
  );
}
