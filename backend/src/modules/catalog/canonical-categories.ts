import type { CategorySchemaConfig } from "./category-schema.validation";

/**
 * Канонические верхнеуровневые категории (Master Baseline 1.5, Step 1.1).
 *
 * `slug` — стабильный технический идентификатор (не RU/AZ/EN display name).
 * `title` — отображаемое название по умолчанию (локализация отдельным слоем).
 *
 * Категории засеиваются детерминированно и идемпотентно при старте приложения
 * (CatalogService.onModuleInit, upsert по slug) — как seed ролей в Security.
 * Новая категория добавляется БЕЗ создания новой Product entity/таблицы:
 * достаточно записи в Category + ACTIVE Category Schema.
 */
export interface CanonicalCategorySeed {
  slug: string;
  title: string;
  /** Пример schema config; undefined → дефолтная пустая конфигурация. */
  schema?: CategorySchemaConfig;
}

export const DEFAULT_SCHEMA_CONFIG: CategorySchemaConfig = {
  attributes: [],
  availability: { enabled: false, dateRequired: false },
  tariffRules: { requiresOptions: false },
  mediaRequirements: {
    minImages: 1,
    maxImages: 10,
    primaryImageRequired: true,
    allowedMediaTypes: ["image/jpeg", "image/png"],
    videoAllowed: false,
  },
  pdpSections: ["overview", "gallery", "tariffs", "availability", "conditions", "partner"],
};

const ACCOMMODATION_SCHEMA: CategorySchemaConfig = {
  attributes: [
    { key: "checkIn", label: "Check-in time", type: "time", required: true },
    { key: "checkOut", label: "Check-out time", type: "time", required: true },
    {
      key: "roomType",
      label: "Room type",
      type: "enum",
      required: true,
      options: ["standard", "superior", "deluxe", "suite", "family", "studio"],
    },
    {
      key: "mealPlan",
      label: "Meal plan",
      type: "enum",
      options: ["room_only", "bed_breakfast", "half_board", "full_board", "all_inclusive"],
    },
    { key: "amenities", label: "Amenities", type: "text", searchable: true },
    { key: "starRating", label: "Star rating", type: "number", required: true, min: 1, max: 5, filterable: true },
  ],
  availability: { enabled: true, dateRequired: true, slotsPerDate: true },
  tariffRules: { requiresOptions: false },
  mediaRequirements: {
    minImages: 5,
    maxImages: 30,
    primaryImageRequired: true,
    allowedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
    videoAllowed: true,
  },
  pdpSections: ["overview", "gallery", "amenities", "tariffs", "availability", "conditions", "cancellationPolicy", "partner"],
};

const TRANSFER_SCHEMA: CategorySchemaConfig = {
  attributes: [
    { key: "origin", label: "Origin", type: "string", required: true, searchable: true },
    { key: "destination", label: "Destination", type: "string", required: true, searchable: true },
    {
      key: "vehicleType",
      label: "Vehicle type",
      type: "enum",
      required: true,
      options: ["car", "minivan", "minibus", "bus", "van"],
    },
    { key: "capacity", label: "Capacity (seats)", type: "integer", min: 1, max: 60, filterable: true },
    { key: "luggageCapacity", label: "Luggage capacity", type: "string" },
  ],
  availability: { enabled: true, dateRequired: true },
  tariffRules: { requiresOptions: false },
  mediaRequirements: {
    minImages: 1,
    maxImages: 10,
    primaryImageRequired: true,
    allowedMediaTypes: ["image/jpeg", "image/png"],
    videoAllowed: false,
  },
  pdpSections: ["overview", "gallery", "vehicle", "conditions", "cancellationPolicy", "availability", "tariffs", "partner"],
};

const EXCURSION_SCHEMA: CategorySchemaConfig = {
  attributes: [
    { key: "duration", label: "Duration (hours)", type: "number", required: true, min: 0.5, filterable: true },
    { key: "meetingPoint", label: "Meeting point", type: "string", required: true },
    { key: "startTime", label: "Start time", type: "time", required: true },
    { key: "language", label: "Language", type: "enum", required: true, options: ["en", "ru", "az", "de", "fr", "es"] },
    { key: "groupSize", label: "Group size", type: "integer", min: 1, max: 100 },
  ],
  availability: { enabled: true, dateRequired: true, slotsPerDate: true },
  tariffRules: { requiresOptions: false },
  mediaRequirements: {
    minImages: 3,
    maxImages: 20,
    primaryImageRequired: true,
    allowedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
    videoAllowed: true,
  },
  pdpSections: ["overview", "gallery", "itinerary", "meetingPoint", "conditions", "cancellationPolicy", "availability", "tariffs", "partner"],
};

const TOURS_SCHEMA: CategorySchemaConfig = {
  attributes: [
    { key: "days", label: "Days", type: "integer", required: true, min: 1, filterable: true },
    { key: "nights", label: "Nights", type: "integer", min: 0 },
    { key: "itinerary", label: "Itinerary", type: "text" },
    { key: "included", label: "Included", type: "text" },
    { key: "excluded", label: "Excluded", type: "text" },
  ],
  availability: { enabled: true, dateRequired: true },
  tariffRules: { requiresOptions: false },
  mediaRequirements: {
    minImages: 5,
    maxImages: 40,
    primaryImageRequired: true,
    allowedMediaTypes: ["image/jpeg", "image/png", "image/webp"],
    videoAllowed: true,
  },
  pdpSections: ["overview", "gallery", "itinerary", "included", "excluded", "conditions", "cancellationPolicy", "availability", "tariffs", "partner"],
};

const CAR_RENTAL_SCHEMA: CategorySchemaConfig = {
  attributes: [
    { key: "pickupLocation", label: "Pickup location", type: "string", required: true, searchable: true },
    { key: "dropoffLocation", label: "Drop-off location", type: "string", required: true },
    {
      key: "vehicleClass",
      label: "Vehicle class",
      type: "enum",
      required: true,
      options: ["economy", "compact", "midsize", "standard", "fullsize", "suv", "minivan", "luxury"],
    },
    { key: "transmission", label: "Transmission", type: "enum", options: ["automatic", "manual"] },
    { key: "deposit", label: "Deposit", type: "currency" },
    { key: "driverRequirements", label: "Driver requirements", type: "text" },
  ],
  availability: { enabled: true, dateRequired: true },
  tariffRules: { requiresOptions: false },
  mediaRequirements: {
    minImages: 4,
    maxImages: 20,
    primaryImageRequired: true,
    allowedMediaTypes: ["image/jpeg", "image/png"],
    videoAllowed: false,
  },
  pdpSections: ["overview", "gallery", "vehicle", "conditions", "cancellationPolicy", "availability", "tariffs", "partner"],
};

/** Канонические категории (Master Baseline 1.5): 18 верхнеуровневых. */
export const CANONICAL_CATEGORIES: CanonicalCategorySeed[] = [
  { slug: "tours", title: "Tours", schema: TOURS_SCHEMA },
  { slug: "accommodation", title: "Accommodation", schema: ACCOMMODATION_SCHEMA },
  { slug: "excursions", title: "Excursions", schema: EXCURSION_SCHEMA },
  { slug: "activities-entertainment", title: "Activities & Entertainment" },
  { slug: "flights", title: "Flights" },
  { slug: "rail", title: "Rail" },
  { slug: "bus-ground-transport", title: "Bus / Ground Transport" },
  { slug: "transfers", title: "Transfers", schema: TRANSFER_SCHEMA },
  { slug: "car-rental", title: "Car Rental", schema: CAR_RENTAL_SCHEMA },
  { slug: "other-vehicle-rental", title: "Other Vehicle Rental" },
  { slug: "guides", title: "Guides" },
  { slug: "cruises", title: "Cruises" },
  { slug: "tickets-events", title: "Tickets & Events" },
  { slug: "food-gastronomy", title: "Food & Gastronomy" },
  { slug: "wellness-spa", title: "Wellness & SPA" },
  { slug: "travel-insurance", title: "Travel Insurance" },
  { slug: "visa-services", title: "Visa Services" },
  { slug: "travel-ancillary-services", title: "Travel Ancillary Services" },
];
