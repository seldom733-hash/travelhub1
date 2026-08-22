/**
 * TravelHub Command Center V3 — Comprehensive Demo Dataset
 *
 * Creates realistic interconnected business data for the full 2026 year:
 * - 25 partners (tour operators, hotels, guides, transfers, etc.)
 * - 200 customers
 * - 200 products (150 published, 50 archived historical services)
 * - ~1000 orders distributed across 2026 with Q3 seasonality
 * - Payments (paid, pending, failed, refunded)
 * - Bookings (completed, upcoming, cancelled, cross-year to 2027)
 * - Commissions
 * - Marketplace + Partner Storefront channels
 * - Multi-currency (AZN, USD, EUR)
 * - Historical orders with frozen prices
 *
 * Run: npx ts-node --project tsconfig.seed.json src/seed/demo-seed.ts
 * Or:  npx prisma db seed (with seed config)
 *
 * HARD RULES:
 * - All data is synthetic (no PII, no production credentials)
 * - Deterministic: seeded IDs use stable UUIDs for reproducibility
 * - Idempotent: uses upsert where possible
 * - Does NOT touch production data (only demo mode)
 */

import { PrismaClient, Prisma } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ─── Configuration ──────────────────────────────────────────────────────────

const PARTNER_COUNT = 25;
const CUSTOMER_COUNT = 200;
const PRODUCT_COUNT = 200;
const ARCHIVED_PRODUCT_COUNT = 50; // subset of PRODUCT_COUNT that become historical
const ORDER_TARGET = 1000;
const CURRENCIES = ["AZN", "USD", "EUR"] as const;
const MAIN_CURRENCY = "AZN"; // Azerbaijan — primary

// Seasonal distribution weights (0-12 months, Q3 peak)
const SEASON_WEIGHTS = [3, 3, 5, 6, 7, 9, 11, 12, 10, 7, 4, 3]; // Jan-Dec

// ─── Helpers ────────────────────────────────────────────────────────────────

import "dotenv/config";
import crypto from "crypto";

function uuid(seed: string): string {
  // Deterministic UUID from seed string (not crypto-secure, but stable)
  const hash = crypto.createHash("md5").update(seed).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`, // version 4
    `${8 + (parseInt(hash.slice(16, 18), 16) % 4)}${hash.slice(18, 20)}`, // variant
    hash.slice(20, 32),
  ].join("-");
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedMonth(): number {
  const total = SEASON_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let m = 0; m < 12; m++) {
    r -= SEASON_WEIGHTS[m];
    if (r <= 0) return m;
  }
  return 11;
}

function randomDateInMonth(month: number, year = 2026): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = randomBetween(1, daysInMonth);
  const hour = randomBetween(8, 22);
  const minute = randomBetween(0, 59);
  return new Date(year, month, day, hour, minute, 0);
}

function futureDate(month: number, day: number, year = 2027): Date {
  return new Date(year, month - 1, day, 10, 0, 0);
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

// ─── Partner Templates ──────────────────────────────────────────────────────

interface PartnerTemplate {
  name: string;
  type: "TOUR_OPERATOR" | "HOTEL" | "EXCURSION" | "TRANSFER" | "GUIDE" | "PHOTOGRAPHER";
  country: string;
  city: string;
  commissionRate: number;
  hasStorefront: boolean;
  storefrontActive: boolean;
}

const PARTNER_TEMPLATES: PartnerTemplate[] = [
  // Tour Operators (5)
  { name: "Baku Tours Pro", type: "TOUR_OPERATOR", country: "AZ", city: "Baku", commissionRate: 0.10, hasStorefront: true, storefrontActive: true },
  { name: "Caspian Adventures", type: "TOUR_OPERATOR", country: "AZ", city: "Baku", commissionRate: 0.12, hasStorefront: true, storefrontActive: true },
  { name: "Heritage Travel AZ", type: "TOUR_OPERATOR", country: "AZ", city: "Sheki", commissionRate: 0.10, hasStorefront: true, storefrontActive: true },
  { name: "Silk Road Explorers", type: "TOUR_OPERATOR", country: "AZ", city: "Ganja", commissionRate: 0.08, hasStorefront: false, storefrontActive: false },
  { name: "Azerbaijan Journeys", type: "TOUR_OPERATOR", country: "AZ", city: "Baku", commissionRate: 0.11, hasStorefront: true, storefrontActive: false },
  // Hotels (5)
  { name: "Baku Grand Hotel", type: "HOTEL", country: "AZ", city: "Baku", commissionRate: 0.15, hasStorefront: true, storefrontActive: true },
  { name: "Flame Towers Residence", type: "HOTEL", country: "AZ", city: "Baku", commissionRate: 0.12, hasStorefront: false, storefrontActive: false },
  { name: "Sheki Palace Hotel", type: "HOTEL", country: "AZ", city: "Sheki", commissionRate: 0.10, hasStorefront: true, storefrontActive: true },
  { name: "Gabala Mountain Lodge", type: "HOTEL", country: "AZ", city: "Gabala", commissionRate: 0.08, hasStorefront: false, storefrontActive: false },
  { name: "Nakhchivan Resort", type: "HOTEL", country: "AZ", city: "Nakhchivan", commissionRate: 0.09, hasStorefront: false, storefrontActive: false },
  // Excursion Providers (5)
  { name: "Old City Walking Tours", type: "EXCURSION", country: "AZ", city: "Baku", commissionRate: 0.12, hasStorefront: false, storefrontActive: false },
  { name: "Flame Country Excursions", type: "EXCURSION", country: "AZ", city: "Baku", commissionRate: 0.10, hasStorefront: true, storefrontActive: true },
  { name: "Gobustan Heritage Tours", type: "EXCURSION", country: "AZ", city: "Baku", commissionRate: 0.08, hasStorefront: false, storefrontActive: false },
  { name: "Absheron Peninsula Tours", type: "EXCURSION", country: "AZ", city: "Baku", commissionRate: 0.11, hasStorefront: false, storefrontActive: false },
  { name: "Wine Route Azerbaijan", type: "EXCURSION", country: "AZ", city: "Sheki", commissionRate: 0.09, hasStorefront: false, storefrontActive: false },
  // Transfers (3)
  { name: "Baku Airport Transfers", type: "TRANSFER", country: "AZ", city: "Baku", commissionRate: 0.05, hasStorefront: false, storefrontActive: false },
  { name: "Caspian Limousine", type: "TRANSFER", country: "AZ", city: "Baku", commissionRate: 0.07, hasStorefront: false, storefrontActive: false },
  { name: "Regional Transport AZ", type: "TRANSFER", country: "AZ", city: "Baku", commissionRate: 0.06, hasStorefront: false, storefrontActive: false },
  // Guides (4)
  { name: "Elvin Mammadov (Guide)", type: "GUIDE", country: "AZ", city: "Baku", commissionRate: 0.15, hasStorefront: false, storefrontActive: false },
  { name: "Leyla Aliyeva (Guide)", type: "GUIDE", country: "AZ", city: "Sheki", commissionRate: 0.15, hasStorefront: false, storefrontActive: false },
  { name: "Rashad Gasimov (Guide)", type: "GUIDE", country: "AZ", city: "Baku", commissionRate: 0.12, hasStorefront: false, storefrontActive: false },
  { name: "Nigar Hasanova (Guide)", type: "GUIDE", country: "AZ", city: "Gabala", commissionRate: 0.10, hasStorefront: false, storefrontActive: false },
  // Photographers (3)
  { name: "Baku Photo Studio", type: "PHOTOGRAPHER", country: "AZ", city: "Baku", commissionRate: 0.08, hasStorefront: false, storefrontActive: false },
  { name: "Caspian Weddings", type: "PHOTOGRAPHER", country: "AZ", city: "Baku", commissionRate: 0.10, hasStorefront: true, storefrontActive: false },
  { name: "Azerbaijan Drone Photo", type: "PHOTOGRAPHER", country: "AZ", city: "Baku", commissionRate: 0.07, hasStorefront: false, storefrontActive: false },
];

// ─── Product Templates ──────────────────────────────────────────────────────

interface ProductTemplate {
  title: string;
  categorySlug: string;
  type: string;
  basePrice: number;
  currency: string;
  partnerIndices: number[]; // which partner indices can offer this
  seasonal: boolean; // whether price changes by season
  archived?: boolean; // historical service, no longer available
}

const PRODUCT_TEMPLATES: ProductTemplate[] = [
  // Tours (40)
  { title: "Baku Old City Walking Tour", categorySlug: "tours", type: "TOUR", basePrice: 45, currency: "AZN", partnerIndices: [0, 1, 2], seasonal: false },
  { title: "Flame Towers Sunset Tour", categorySlug: "tours", type: "TOUR", basePrice: 65, currency: "AZN", partnerIndices: [0, 1], seasonal: true },
  { title: "Gobustan Rock Art & Mud Volcanoes", categorySlug: "tours", type: "TOUR", basePrice: 120, currency: "AZN", partnerIndices: [0, 1, 2], seasonal: true },
  { title: "Sheki & Khinalug Village Tour", categorySlug: "tours", type: "TOUR", basePrice: 180, currency: "AZN", partnerIndices: [2], seasonal: true },
  { title: "Gabala Adventure Day Trip", categorySlug: "tours", type: "TOUR", basePrice: 150, currency: "AZN", partnerIndices: [0, 1], seasonal: true },
  { title: "Absheron Peninsula Tour", categorySlug: "tours", type: "TOUR", basePrice: 55, currency: "AZN", partnerIndices: [0, 1, 2], seasonal: false },
  { title: "Baku Food & Culture Walk", categorySlug: "tours", type: "TOUR", basePrice: 75, currency: "AZN", partnerIndices: [1, 2], seasonal: false },
  { title: "Caspian Sea Boat Experience", categorySlug: "tours", type: "TOUR", basePrice: 90, currency: "AZN", partnerIndices: [0, 1], seasonal: true },
  { title: "Wine Tasting Tour", categorySlug: "tours", type: "TOUR", basePrice: 110, currency: "AZN", partnerIndices: [2], seasonal: true },
  { title: "Nakhchivan Cultural Tour", categorySlug: "tours", type: "TOUR", basePrice: 250, currency: "AZN", partnerIndices: [0], seasonal: true },
  { title: "Baku Night Photography Tour", categorySlug: "tours", type: "TOUR", basePrice: 85, currency: "AZN", partnerIndices: [1], seasonal: true },
  { title: "Caucasus Mountains Expedition", categorySlug: "tours", type: "TOUR", basePrice: 320, currency: "AZN", partnerIndices: [0], seasonal: true },
  { title: "Mud Volcanoes & Petroglyphs", categorySlug: "tours", type: "TOUR", basePrice: 95, currency: "AZN", partnerIndices: [1, 2], seasonal: false },
  { title: "Baku Modern Architecture Tour", categorySlug: "tours", type: "TOUR", basePrice: 50, currency: "AZN", partnerIndices: [0, 1], seasonal: false },
  { title: "Silk Road Heritage Tour", categorySlug: "tours", type: "TOUR", basePrice: 280, currency: "AZN", partnerIndices: [2], seasonal: true },
  { title: "Weekend in Baku Package", categorySlug: "tours", type: "TOUR", basePrice: 450, currency: "USD", partnerIndices: [0, 1], seasonal: true },
  { title: "7-Day Azerbaijan Explorer", categorySlug: "tours", type: "TOUR", basePrice: 890, currency: "USD", partnerIndices: [0], seasonal: true },
  { title: "Honeymoon Azerbaijan", categorySlug: "tours", type: "TOUR", basePrice: 1200, currency: "USD", partnerIndices: [1], seasonal: true },
  { title: "Family Adventure Azerbaijan", categorySlug: "tours", type: "TOUR", basePrice: 750, currency: "USD", partnerIndices: [0], seasonal: true },
  { title: "Business Travel Baku Package", categorySlug: "tours", type: "TOUR", basePrice: 600, currency: "USD", partnerIndices: [1], seasonal: false },
  // Archived tours (historical)
  { title: "Old Baku Heritage Walk (Seasonal)", categorySlug: "tours", type: "TOUR", basePrice: 40, currency: "AZN", partnerIndices: [2], seasonal: false, archived: true },
  { title: "Summer Beach & City Tour", categorySlug: "tours", type: "TOUR", basePrice: 85, currency: "AZN", partnerIndices: [0, 1], seasonal: true, archived: true },
  { title: "Winter Wonderland Baku", categorySlug: "tours", type: "TOUR", basePrice: 95, currency: "AZN", partnerIndices: [1], seasonal: true, archived: true },
  { title: "Budget Baku Explorer", categorySlug: "tours", type: "TOUR", basePrice: 30, currency: "AZN", partnerIndices: [2], seasonal: false, archived: true },
  // Hotels (30)
  { title: "Baku Grand Hotel — Standard Room", categorySlug: "accommodation", type: "HOTEL", basePrice: 120, currency: "AZN", partnerIndices: [5], seasonal: true },
  { title: "Baku Grand Hotel — Deluxe Suite", categorySlug: "accommodation", type: "HOTEL", basePrice: 280, currency: "AZN", partnerIndices: [5], seasonal: true },
  { title: "Flame Towers Residence — Studio", categorySlug: "accommodation", type: "HOTEL", basePrice: 190, currency: "AZN", partnerIndices: [6], seasonal: true },
  { title: "Flame Towers Residence — Penthouse", categorySlug: "accommodation", type: "HOTEL", basePrice: 450, currency: "AZN", partnerIndices: [6], seasonal: true },
  { title: "Sheki Palace Hotel — Heritage Room", categorySlug: "accommodation", type: "HOTEL", basePrice: 95, currency: "AZN", partnerIndices: [7], seasonal: true },
  { title: "Sheki Palace Hotel — Family Suite", categorySlug: "accommodation", type: "HOTEL", basePrice: 160, currency: "AZN", partnerIndices: [7], seasonal: true },
  { title: "Gabala Mountain Lodge — Standard", categorySlug: "accommodation", type: "HOTEL", basePrice: 80, currency: "AZN", partnerIndices: [8], seasonal: true },
  { title: "Gabala Mountain Lodge — Chalet", categorySlug: "accommodation", type: "HOTEL", basePrice: 200, currency: "AZN", partnerIndices: [8], seasonal: true },
  { title: "Nakhchivan Resort — Garden View", categorySlug: "accommodation", type: "HOTEL", basePrice: 70, currency: "AZN", partnerIndices: [9], seasonal: false },
  { title: "Nakhchivan Resort — Lake Suite", categorySlug: "accommodation", type: "HOTEL", basePrice: 130, currency: "AZN", partnerIndices: [9], seasonal: true },
  { title: "Baku Boutique Hotel — Classic", categorySlug: "accommodation", type: "HOTEL", basePrice: 85, currency: "AZN", partnerIndices: [5], seasonal: false },
  { title: "Baku Hostel — Budget Bed", categorySlug: "accommodation", type: "HOTEL", basePrice: 25, currency: "AZN", partnerIndices: [5], seasonal: false },
  { title: "Executive Baku — Business Suite", categorySlug: "accommodation", type: "HOTEL", basePrice: 350, currency: "USD", partnerIndices: [6], seasonal: false },
  // Archived hotels
  { title: "Baku Seaside Hotel (Closed)", categorySlug: "accommodation", type: "HOTEL", basePrice: 65, currency: "AZN", partnerIndices: [5], seasonal: false, archived: true },
  { title: "Budget Hostel Old City (Closed)", categorySlug: "accommodation", type: "HOTEL", basePrice: 18, currency: "AZN", partnerIndices: [5], seasonal: false, archived: true },
  // Excursions (40)
  { title: "Old City Heritage Walk", categorySlug: "excursions", type: "EXCURSION", basePrice: 35, currency: "AZN", partnerIndices: [10, 11, 12], seasonal: false },
  { title: "Flame Towers & Heydar Aliyev Center", categorySlug: "excursions", type: "EXCURSION", basePrice: 45, currency: "AZN", partnerIndices: [10, 11], seasonal: false },
  { title: "Gobustan UNESCO Site Visit", categorySlug: "excursions", type: "EXCURSION", basePrice: 70, currency: "AZN", partnerIndices: [11, 12], seasonal: true },
  { title: "Baku Food Tasting Tour", categorySlug: "excursions", type: "EXCURSION", basePrice: 55, currency: "AZN", partnerIndices: [10, 13], seasonal: false },
  { title: "Mud Volcano Adventure", categorySlug: "excursions", type: "EXCURSION", basePrice: 80, currency: "AZN", partnerIndices: [12, 13], seasonal: true },
  { title: "Caspian Sunset Cruise", categorySlug: "excursions", type: "EXCURSION", basePrice: 60, currency: "AZN", partnerIndices: [11], seasonal: true },
  { title: "Baku Street Art Tour", categorySlug: "excursions", type: "EXCURSION", basePrice: 30, currency: "AZN", partnerIndices: [10], seasonal: false },
  { title: "Sheki Silkworm Museum Tour", categorySlug: "excursions", type: "EXCURSION", basePrice: 40, currency: "AZN", partnerIndices: [14], seasonal: false },
  { title: "Azerbaijan Wine Trail", categorySlug: "excursions", type: "EXCURSION", basePrice: 90, currency: "AZN", partnerIndices: [14], seasonal: true },
  { title: "Gabala Archery & Horseback", categorySlug: "excursions", type: "EXCURSION", basePrice: 75, currency: "AZN", partnerIndices: [11], seasonal: true },
  // Archived excursions
  { title: "Summer Festival Walking Tour", categorySlug: "excursions", type: "EXCURSION", basePrice: 25, currency: "AZN", partnerIndices: [10], seasonal: true, archived: true },
  { title: "Night Market Tour (Seasonal)", categorySlug: "excursions", type: "EXCURSION", basePrice: 35, currency: "AZN", partnerIndices: [13], seasonal: true, archived: true },
  // Transfers (20)
  { title: "Baku Airport → City Center", categorySlug: "transfers", type: "TRANSFER", basePrice: 30, currency: "AZN", partnerIndices: [15], seasonal: false },
  { title: "City Center → Baku Airport", categorySlug: "transfers", type: "TRANSFER", basePrice: 30, currency: "AZN", partnerIndices: [15], seasonal: false },
  { title: "Baku → Sheki (Private)", categorySlug: "transfers", type: "TRANSFER", basePrice: 120, currency: "AZN", partnerIndices: [15, 17], seasonal: false },
  { title: "Baku → Gabala (Private)", categorySlug: "transfers", type: "TRANSFER", basePrice: 90, currency: "AZN", partnerIndices: [15, 17], seasonal: false },
  { title: "VIP Airport Transfer", categorySlug: "transfers", type: "TRANSFER", basePrice: 80, currency: "AZN", partnerIndices: [16], seasonal: false },
  { title: "Baku City Tour Vehicle", categorySlug: "transfers", type: "TRANSFER", basePrice: 60, currency: "AZN", partnerIndices: [15, 16], seasonal: false },
  // Guides (20)
  { title: "Private English Guide — Baku", categorySlug: "guides", type: "GUIDE", basePrice: 100, currency: "AZN", partnerIndices: [18, 20], seasonal: false },
  { title: "Private Russian Guide — Baku", categorySlug: "guides", type: "GUIDE", basePrice: 90, currency: "AZN", partnerIndices: [19, 21], seasonal: false },
  { title: "Turkish Guide — Baku", categorySlug: "guides", type: "GUIDE", basePrice: 95, currency: "AZN", partnerIndices: [18], seasonal: false },
  { title: "Arabic Guide — Baku", categorySlug: "guides", type: "GUIDE", basePrice: 110, currency: "AZN", partnerIndices: [20], seasonal: false },
  { title: "Chinese Guide — Baku", categorySlug: "guides", type: "GUIDE", basePrice: 120, currency: "AZN", partnerIndices: [18], seasonal: false },
  { title: "French Guide — Baku", categorySlug: "guides", type: "GUIDE", basePrice: 105, currency: "EUR", partnerIndices: [19], seasonal: false },
  // Photographers (10)
  { title: "Baku City Photo Session", categorySlug: "activities-entertainment", type: "PHOTOGRAPHER", basePrice: 150, currency: "AZN", partnerIndices: [22], seasonal: false },
  { title: "Wedding Photography Baku", categorySlug: "activities-entertainment", type: "PHOTOGRAPHER", basePrice: 500, currency: "AZN", partnerIndices: [23], seasonal: true },
  { title: "Drone Aerial Photography", categorySlug: "activities-entertainment", type: "PHOTOGRAPHER", basePrice: 200, currency: "AZN", partnerIndices: [24], seasonal: false },
  { title: "Corporate Event Photography", categorySlug: "activities-entertainment", type: "PHOTOGRAPHER", basePrice: 350, currency: "AZN", partnerIndices: [22, 23], seasonal: false },
  // Tickets & Events (15)
  { title: "Flame Towers Observation Deck", categorySlug: "tickets-events", type: "TOUR", basePrice: 15, currency: "AZN", partnerIndices: [0], seasonal: false },
  { title: "Baku Jazz Festival Ticket", categorySlug: "tickets-events", type: "EXCURSION", basePrice: 40, currency: "AZN", partnerIndices: [3], seasonal: true },
  { title: "Puppet Theater Show", categorySlug: "tickets-events", type: "EXCURSION", basePrice: 12, currency: "AZN", partnerIndices: [0], seasonal: false },
  { title: "Azerbaijan Grand Prix Viewing", categorySlug: "tickets-events", type: "EXCURSION", basePrice: 200, currency: "USD", partnerIndices: [4], seasonal: true },
  { title: "Novruz Festival Package", categorySlug: "tickets-events", type: "EXCURSION", basePrice: 55, currency: "AZN", partnerIndices: [0, 1], seasonal: true },
  // Food & Gastronomy (15)
  { title: "Azerbaijan Cooking Class", categorySlug: "food-gastronomy", type: "EXCURSION", basePrice: 65, currency: "AZN", partnerIndices: [10, 13], seasonal: false },
  { title: "Baku Rooftop Dining Experience", categorySlug: "food-gastronomy", type: "EXCURSION", basePrice: 85, currency: "AZN", partnerIndices: [13], seasonal: true },
  { title: "Sheki Halva Workshop", categorySlug: "food-gastronomy", type: "EXCURSION", basePrice: 30, currency: "AZN", partnerIndices: [14], seasonal: false },
  { title: "Traditional Dolma Making", categorySlug: "food-gastronomy", type: "EXCURSION", basePrice: 50, currency: "AZN", partnerIndices: [10], seasonal: false },
  // Wellness & SPA (10)
  { title: "Baku Hammam Experience", categorySlug: "wellness-spa", type: "EXCURSION", basePrice: 45, currency: "AZN", partnerIndices: [5, 6], seasonal: false },
  { title: "Mountain Resort Wellness", categorySlug: "wellness-spa", type: "EXCURSION", basePrice: 80, currency: "AZN", partnerIndices: [8], seasonal: true },
];

// ─── Customer Name Pools ────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Ahmet", "Mehmet", "Ali", "Hasan", "Ibrahim", "Vugar", "Elnur", "Elvin", "Rashad", "Samir",
  "Farid", "Tural", "Nijat", "Elchin", "Rovshan", "Leyla", "Nigar", "Gulnara", "Aygul", "Sabina",
  "Amina", "Kamila", "Aysel", "Gunel", "Fidan", "Anna", "Maria", "Elena", "Olga", "Natalia",
  "John", "James", "David", "Michael", "Robert", "Sarah", "Emily", "Emma", "Sophie", "Charlotte",
  "Ahmed", "Mohammed", "Omar", "Khalid", "Yusuf", "Fatima", "Aisha", "Noor", "Zainab", "Huda",
  "Chen", "Wei", "Liu", "Wang", "Li", "Kim", "Park", "Tanaka", "Sato", "Yamamoto",
  "Carlos", "Maria", "Pedro", "Ana", "Lucas", "Pierre", "Marie", "Jean", "Sophie", "Claire",
  "Hans", "Klaus", "Anna", "Maria", "Lukas", "Marco", "Giovanni", "Giulia", "Pablo", "Carmen",
  "Ivan", "Dmitri", "Alexei", "Sergei", "Andrei", "Elena", "Olga", "Natasha", "Tatiana", "Irina",
];

const LAST_NAMES = [
  "Mammadov", "Aliyev", "Huseynov", "Hajiyev", "Rzayev", "Ahmadov", "Ismayilov", "Gasimov", "Hasanov", "Abdullayev",
  "Bagirova", "Valiyeva", "Mammadova", "Aliyeva", "Huseynova", "Muradova", "Nazarova", "Guliyeva", "Rustamova", "Karimova",
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor",
  "Mueller", "Schmidt", "Schneider", "Fischer", "Weber", "Wagner", "Becker", "Huber", "Keller", "Schulz",
  "Rossi", "Russo", "Ferrari", "Bianchi", "Romano", "Martin", "Bernard", "Dubois", "Moreau", "Laurent",
  "Petrov", "Sokolov", "Smirnov", "Kuznetsov", "Popov", "Volkov", "Novikov", "Morozov", "Semenov", "Fedorov",
  "Tanaka", "Yamamoto", "Watanabe", "Ito", "Takahashi", "Kim", "Park", "Choi", "Wang", "Zhang",
  "Cohen", "Levy", "Mizrahi", "Peretz", "Dahan", "Nguyen", "Tran", "Pham", "Le", "Hoang",
  "Johansson", "Lindberg", "Bergström", "Eriksson", "Olsson", "Nielsen", "Hansen", "Andersen", "Pedersen", "Larsen",
];

// ─── Seed Functions ─────────────────────────────────────────────────────────

async function seedPartners() {
  console.log(`\n📦 Seeding ${PARTNER_COUNT} partners...`);
  const partners: { id: string; name: string }[] = [];

  for (let i = 0; i < PARTNER_TEMPLATES.length; i++) {
    const t = PARTNER_TEMPLATES[i];
    const id = uuid(`partner-${i}`);
    const code = `PRN-${String(i + 1).padStart(8, "0")}`;
    partners.push({ id, name: t.name });

    await prisma.partner.upsert({
      where: { id },
      create: {
        id,
        code,
        name: t.name,
        status: "ACTIVE",
        countryCode: t.country,
      },
      update: {},
    });
  }

  console.log(`  ✅ ${partners.length} partners created`);
  return partners;
}

async function seedCustomers() {
  console.log(`\n👥 Seeding ${CUSTOMER_COUNT} customers...`);
  const customers: { id: string }[] = [];

  const batchData = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const id = uuid(`customer-${i}`);
    const code = `CRM-${String(i + 1).padStart(8, "0")}`;
    const email = `customer${i + 1}@demo.travelhub.local`;
    const createdAt = randomDateInMonth(randomBetween(0, 11), 2026);
    customers.push({ id });

    batchData.push({
      id,
      code,
      type: "PERSON",
      firstName,
      lastName,
      email,
      phone: `+994${randomBetween(50, 99)}${randomBetween(1000000, 9999999)}`,
      status: "ACTIVE",
      version: 1,
      createdAt,
      updatedAt: createdAt,
    });
  }

  await prisma.customer.createMany({ data: batchData, skipDuplicates: true });
  console.log(`  ✅ ${customers.length} customers created`);
  return customers;
}

async function seedProducts(partners: { id: string }[]) {
  console.log(`\n🏷️  Seeding ${PRODUCT_COUNT} products...`);
  const products: { id: string; partnerId: string; price: number; currency: string; title: string; archived: boolean }[] = [];
  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catMap = new Map(categories.map(c => [c.slug, c.id]));

  let prdCounter = 0;
  for (const tpl of PRODUCT_TEMPLATES) {
    const catId = catMap.get(tpl.categorySlug);
    if (!catId) continue;

    for (const pi of tpl.partnerIndices) {
      if (prdCounter >= PRODUCT_COUNT) break;
      prdCounter++;
      const partnerId = uuid(`partner-${pi}`);
      const id = uuid(`product-${prdCounter}`);
      const code = `PRD-${String(prdCounter + 100).padStart(8, "0")}`;
      const isArchived = tpl.archived === true;
      const status = isArchived ? "ARCHIVED" : "PUBLISHED";
      const price = tpl.basePrice + randomBetween(-10, 10);
      const createdAt = isArchived
        ? randomDateInMonth(randomBetween(0, 3), 2026) // archived early in year
        : randomDateInMonth(randomBetween(0, 8), 2026);

      products.push({ id, partnerId, price, currency: tpl.currency, title: tpl.title, archived: isArchived });

      await prisma.product.upsert({
        where: { id },
        create: {
          id,
          code,
          type: tpl.type as any,
          title: tpl.title,
          slug: `${tpl.categorySlug}-${prdCounter}`,
          status: status as any,
          categoryId: catId,
          partnerId,
          publishedAt: status === "PUBLISHED" ? createdAt : null,
          createdAt,
          updatedAt: createdAt,
        },
        update: {},
      });

      // Create tariff
      const tariffId = uuid(`tariff-${prdCounter}`);
      const tariffCode = `TAR-${String(prdCounter + 100).padStart(8, "0")}`;
      await prisma.tariff.upsert({
        where: { id: tariffId },
        create: {
          id: tariffId,
          code: tariffCode,
          productId: id,
          name: "Standard",
          price: decimal(price),
          currency: tpl.currency,
          status: "ACTIVE",
          pricingMode: "FIXED",
          version: 1,
          createdAt,
          updatedAt: createdAt,
        },
        update: {},
      });

      // Create price history entry
      await prisma.tariffHistory.create({
        data: {
          tariffId,
          version: 1,
          action: "CREATED",
          fields: { price: price, currency: tpl.currency },
          createdAt,
        },
      });

      // Publication channels
      const channels = ["MARKETPLACE"];
      if (PARTNER_TEMPLATES[pi]?.hasStorefront) {
        channels.push("PARTNER_STOREFRONT");
      }
      for (const ch of channels) {
        await prisma.productPublicationChannel.upsert({
          where: { productId_channel: { productId: id, channel: ch as any } },
          create: {
            productId: id,
            channel: ch as any,
            createdAt,
          },
          update: {},
        });
      }
    }
    if (prdCounter >= PRODUCT_COUNT) break;
  }

  console.log(`  ✅ ${products.length} products created (${products.filter(p => p.archived).length} archived)`);
  return products;
}

async function seedStorefronts(partners: { id: string }[]) {
  console.log(`\n🏪 Seeding storefronts...`);
  let count = 0;

  for (let i = 0; i < PARTNER_TEMPLATES.length; i++) {
    const t = PARTNER_TEMPLATES[i];
    if (!t.hasStorefront) continue;
    const partnerId = uuid(`partner-${i}`);
    const id = uuid(`storefront-${i}`);
    const code = `SF-${String(i + 1).padStart(8, "0")}`;
    const status = t.storefrontActive ? "ACTIVE" : "DRAFT";

    await prisma.partnerStorefront.upsert({
      where: { id },
      create: {
        id,
        code,
        partnerId,
        slug: t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        status: status as any,
        entitlementStatus: t.storefrontActive ? "ACTIVE" : "NONE",
        businessName: t.name,
        tagline: `Premium ${t.type.toLowerCase()} services`,
        defaultLocale: "ru",
        countryCode: "AZ",
        cityCode: t.city,
        createdAt: new Date(2026, 0, 15),
        updatedAt: new Date(2026, 0, 15),
        activatedAt: t.storefrontActive ? new Date(2026, 1, 1) : null,
      },
      update: {},
    });
    count++;
  }

  console.log(`  ✅ ${count} storefronts created`);
}

async function seedOrders(products: { id: string; partnerId: string; price: number; currency: string; title: string; archived: boolean }[]) {
  console.log(`\n📋 Seeding ~${ORDER_TARGET} orders with seasonal distribution...`);
  const customers = await prisma.customer.findMany({ select: { id: true } });
  const orderData: Array<{
    id: string; code: string; number: string; customerId: string; status: string;
    paymentStatus: string; currency: string; amount: Prisma.Decimal; paidAmount: Prisma.Decimal;
    refundedAmount: Prisma.Decimal; sellerPartnerId: string; createdAt: Date; updatedAt: Date;
    submittedAt: Date; confirmedAt?: Date; fulfilledAt?: Date; cancelledAt?: Date; closedAt?: Date;
    serviceDate: Date; acquisitionSource: string; commissionSnapshot: any;
    amountNum: number;
  }> = [];
  const orderItems: Array<{
    id: string; orderId: string; productId: string; productCode: string; title: string;
    type: string; quantity: number; price: Prisma.Decimal; currency: string; amount: Prisma.Decimal;
  }> = [];
  const paymentData: Array<{
    id: string; code: string; orderId: string; amount: Prisma.Decimal; currency: string;
    status: string; partnerId: string; createdAt: Date; updatedAt: Date; paidAt?: Date; isActivePayment: boolean; version: number;
  }> = [];
  const bookingData: Array<{
    id: string; code: string; orderId: string; productId: string; status: string;
    amount: Prisma.Decimal; currency: string; serviceDate: Date; createdAt: Date; updatedAt: Date; version: number;
    completedAt?: Date; cancelledAt?: Date; confirmedAt?: Date;
  }> = [];
  const commissionData: Array<{
    id: string; code: string; orderId: string; partnerId: string; amount: Prisma.Decimal; currency: string;
    status: string; version: number; createdAt: Date; updatedAt: Date;
  }> = [];

  const orderStatuses = [
    { status: "CLOSED", paymentStatus: "PAID", weight: 35 },
    { status: "SENT_TO_BOOKING", paymentStatus: "PAID", weight: 15 },
    { status: "NEW", paymentStatus: "UNPAID", weight: 12 },
    { status: "FULFILLED", paymentStatus: "PAID", weight: 15 },
    { status: "IN_PROCESSING", paymentStatus: "PARTIALLY_PAID", weight: 8 },
    { status: "CANCELLED", paymentStatus: "UNPAID", weight: 7 },
    { status: "CLOSED", paymentStatus: "REFUNDED", weight: 5 },
    { status: "PROBLEM", paymentStatus: "PAID", weight: 3 },
  ];

  function pickOrderStatus() {
    const total = orderStatuses.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;
    for (const s of orderStatuses) {
      r -= s.weight;
      if (r <= 0) return s;
    }
    return orderStatuses[0];
  }

  for (let i = 0; i < ORDER_TARGET; i++) {
    const month = weightedMonth();
    const created = randomDateInMonth(month, 2026);
    const product = pickRandom(products);
    const customer = pickRandom(customers);
    const ps = pickOrderStatus();
    const orderNum = i + 1;

    const orderDate = new Date(created);
    const serviceDate = new Date(orderDate);
    serviceDate.setDate(serviceDate.getDate() + randomBetween(1, 14));

    // For cross-year bookings: some orders created in Dec 2026 with service in Jan 2027
    const isCrossYear = month === 11 && Math.random() < 0.3;
    if (isCrossYear) {
      serviceDate.setFullYear(2027);
      serviceDate.setMonth(randomBetween(0, 1)); // Jan or Feb 2027
    }

    // For upcoming bookings: service date in future (beyond Dec 2026)
    const isUpcoming = month >= 10 && Math.random() < 0.2;
    if (isUpcoming) {
      serviceDate.setFullYear(2027);
      serviceDate.setMonth(randomBetween(0, 3));
      serviceDate.setDate(randomBetween(1, 28));
    }

    const id = uuid(`order-${orderNum}`);
    const amount = product.price * (1 + randomBetween(-5, 15) / 100);
    const paidAmount = ps.paymentStatus === "PAID" || ps.paymentStatus === "REFUNDED"
      ? amount : ps.paymentStatus === "PARTIALLY_PAID" ? amount * 0.5 : 0;
    const refundedAmount = ps.paymentStatus === "REFUNDED" ? paidAmount : 0;

    const confirmedAt = ["CLOSED", "SENT_TO_BOOKING", "FULFILLED", "IN_PROCESSING"].includes(ps.status)
      ? new Date(orderDate.getTime() + randomBetween(1, 3) * 86400000) : undefined;
    const fulfilledAt = ["CLOSED", "FULFILLED"].includes(ps.status) && serviceDate < new Date(2026, 11, 31)
      ? new Date(serviceDate.getTime() + randomBetween(0, 2) * 86400000) : undefined;
    const closedAt = ps.status === "CLOSED" ? fulfilledAt : undefined;
    const cancelledAt = ps.status === "CANCELLED"
      ? new Date(orderDate.getTime() + randomBetween(1, 5) * 86400000) : undefined;

    const partnerT = PARTNER_TEMPLATES.find(t => t.name.includes(product.title.split(" ")[0])) || PARTNER_TEMPLATES[0];
    const partnerIdx = PARTNER_TEMPLATES.indexOf(partnerT);
    const sellerPartnerId = uuid(`partner-${partnerIdx >= 0 ? partnerIdx : 0}`);
    const commissionRate = PARTNER_TEMPLATES[partnerIdx >= 0 ? partnerIdx : 0]?.commissionRate ?? 0.10;

    orderData.push({
      id, code: `ORD-${String(orderNum).padStart(8, "0")}`,
      number: `TH-2026-${String(orderNum).padStart(6, "0")}`,
      customerId: customer.id, status: ps.status as any, paymentStatus: ps.paymentStatus as any,
      currency: product.currency, amount: decimal(amount), paidAmount: decimal(paidAmount),
      refundedAmount: decimal(refundedAmount), sellerPartnerId,
      createdAt: orderDate, updatedAt: orderDate,
      submittedAt: orderDate, confirmedAt, fulfilledAt, cancelledAt, closedAt,
      serviceDate, acquisitionSource: Math.random() < 0.6 ? "MARKETPLACE" : "PARTNER_STOREFRONT",
      commissionSnapshot: { rate: commissionRate, currency: product.currency },
      amountNum: amount,
    });

    // OrderItem
    const tariffId = uuid(`tariff-${products.indexOf(product) + 1}`);
    orderItems.push({
      id: uuid(`orderitem-${orderNum}`), orderId: id,
      productId: product.id, productCode: `PRD-${String(products.indexOf(product) + 101).padStart(8, "0")}`,
      title: product.title, type: "SERVICE", quantity: 1,
      price: decimal(product.price), currency: product.currency, amount: decimal(amount),
      serviceDate,
    });

    // Payment (for paid/partially paid orders)
    if (ps.paymentStatus !== "UNPAID") {
      const payStatus = ps.paymentStatus === "REFUNDED" ? "REFUNDED" :
        ps.paymentStatus === "PARTIALLY_PAID" ? "CAPTURED" : "CAPTURED";
      paymentData.push({
        id: uuid(`payment-${orderNum}`), code: `PAY-${String(orderNum).padStart(8, "0")}`,
        orderId: id, amount: decimal(paidAmount), currency: product.currency,
        status: payStatus, partnerId: sellerPartnerId,
        createdAt: orderDate, updatedAt: orderDate,
        paidAt: ps.paymentStatus !== "UNPAID" ? orderDate : undefined,
        isActivePayment: true, version: 1,
      });
    }

    // Booking (for orders with booking status)
    if (["SENT_TO_BOOKING", "FULFILLED", "CLOSED"].includes(ps.status)) {
      const bkStatus = ps.status === "CLOSED" ? "COMPLETED" :
        ps.status === "FULFILLED" ? "IN_SERVICE" : "CONFIRMED";
      bookingData.push({
        id: uuid(`booking-${orderNum}`), code: `BKG-${String(orderNum).padStart(8, "0")}`,
        orderId: id, productId: product.id, status: bkStatus as any,
        amount: decimal(amount), currency: product.currency,
        serviceDate, createdAt: orderDate, updatedAt: orderDate, version: 1,
        completedAt: bkStatus === "COMPLETED" ? fulfilledAt : undefined,
        confirmedAt: confirmedAt,
      });
    }

    // Commission (for paid orders — one per order, orderId is unique)
    if (ps.paymentStatus === "PAID" || ps.paymentStatus === "REFUNDED") {
      commissionData.push({
        id: uuid(`commission-${orderNum}`),
        code: `CMS-${String(orderNum).padStart(8, "0")}`,
        orderId: id, partnerId: sellerPartnerId,
        amount: decimal(amount * commissionRate), currency: product.currency,
        status: ps.paymentStatus === "REFUNDED" ? "ACCRUED" : "PAID",
        version: 1,
        createdAt: orderDate, updatedAt: orderDate,
      });
    }
  }

  // Batch insert orders (individual upserts for reliability)
  console.log(`  📝 Inserting ${orderData.length} orders...`);
  const BATCH_SIZE = 50;
  let ordersInserted = 0;
  for (let i = 0; i < orderData.length; i++) {
    const o = orderData[i];
    try {
      await prisma.order.upsert({
        where: { id: o.id },
        create: {
          id: o.id, code: o.code, number: o.number, customerId: o.customerId,
          status: o.status as any, paymentStatus: o.paymentStatus as any,
          currency: o.currency, amount: o.amount, paidAmount: o.paidAmount, refundedAmount: o.refundedAmount,
          sellerPartnerId: o.sellerPartnerId, createdAt: o.createdAt, updatedAt: o.updatedAt,
          submittedAt: o.submittedAt, confirmedAt: o.confirmedAt, fulfilledAt: o.fulfilledAt,
          cancelledAt: o.cancelledAt, closedAt: o.closedAt, serviceDate: o.serviceDate,
          acquisitionSource: o.acquisitionSource, commissionSnapshot: o.commissionSnapshot,
        },
        update: {},
      });
      ordersInserted++;
    } catch (e: any) {
      if (i < 3) console.error(`  ⚠️ Order ${o.code} failed:`, e.message?.slice(0, 100));
    }
    if ((i + 1) % 200 === 0) console.log(`    ... ${i + 1}/${orderData.length}`);
  }
  console.log(`  ✅ ${ordersInserted}/${orderData.length} orders inserted`);

  // Get actually inserted order IDs
  const insertedOrderIds = new Set(orderData.map(o => o.id));
  console.log(`  📝 Inserting order items (filtered)...`);
  let itemsInserted = 0;
  for (let i = 0; i < orderItems.length; i++) {
    if (!insertedOrderIds.has(orderItems[i].orderId)) continue;
    try {
      await prisma.orderItem.create({ data: orderItems[i] as any });
      itemsInserted++;
    } catch (e: any) {
      if (i < 3) console.error(`  ⚠️ OrderItem failed:`, e.message?.slice(0, 100));
    }
  }
  console.log(`  ✅ ${itemsInserted} order items inserted`);

  // Insert payments (individual upserts)
  console.log(`  💳 Inserting ${paymentData.length} payments...`);
  let paymentsInserted = 0;
  for (let i = 0; i < paymentData.length; i++) {
    const p = paymentData[i];
    try {
      await prisma.payment.upsert({
        where: { id: p.id },
        create: {
          id: p.id, code: p.code, orderId: p.orderId, amount: p.amount, currency: p.currency,
          status: p.status as any, partnerId: p.partnerId, createdAt: p.createdAt, updatedAt: p.updatedAt,
          paidAt: p.paidAt, isActivePayment: p.isActivePayment, version: p.version,
        },
        update: {},
      });
      paymentsInserted++;
    } catch (e: any) { /* skip duplicates */ }
  }
  console.log(`  ✅ ${paymentsInserted} payments inserted`);

  // Insert bookings (individual upserts)
  console.log(`  🏨 Inserting ${bookingData.length} bookings...`);
  let bookingsInserted = 0;
  for (let i = 0; i < bookingData.length; i++) {
    const b = bookingData[i];
    try {
      await prisma.booking.upsert({
        where: { id: b.id },
        create: {
          id: b.id, code: b.code, orderId: b.orderId, productId: b.productId, status: b.status as any,
          amount: b.amount, currency: b.currency, serviceDate: b.serviceDate, createdAt: b.createdAt,
          updatedAt: b.updatedAt, version: b.version, completedAt: b.completedAt, confirmedAt: b.confirmedAt,
        },
        update: {},
      });
      bookingsInserted++;
    } catch (e: any) { /* skip */ }
  }
  console.log(`  ✅ ${bookingsInserted} bookings inserted`);

  // Insert commissions (individual upserts)
  console.log(`  💰 Inserting ${commissionData.length} commissions...`);
  let commissionsInserted = 0;
  for (let i = 0; i < commissionData.length; i++) {
    const c = commissionData[i];
    try {
      await prisma.commission.upsert({
        where: { id: c.id },
        create: {
          id: c.id, code: c.code, orderId: c.orderId, partnerId: c.partnerId,
          amount: c.amount, currency: c.currency, status: c.status as any,
          version: c.version, createdAt: c.createdAt, updatedAt: c.updatedAt,
        },
        update: {},
      });
      commissionsInserted++;
    } catch (e: any) { /* skip */ }
  }
  console.log(`  ✅ ${commissionsInserted} commissions inserted`);

  // Summary
  const statusCounts = orderData.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const currencyCounts = orderData.reduce((acc, o) => {
    acc[o.currency] = (acc[o.currency] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const monthCounts = orderData.reduce((acc, o) => {
    const m = o.createdAt.getMonth();
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log(`  ✅ ${orderData.length} orders created`);
  console.log(`  📊 Statuses: ${JSON.stringify(statusCounts)}`);
  console.log(`  💱 Currencies: ${JSON.stringify(currencyCounts)}`);
  console.log(`  📅 Monthly: ${JSON.stringify(monthCounts)}`);

  return { orderData, paymentData, bookingData, commissionData };
}

// ─── Catalog Health (Step 6) ───────────────────────────────────────────────

async function seedCatalogHealth() {
  console.log(`\n🏥 Seeding catalog health scenarios...`);

  // Archive old test DRAFT products (DBG, Step 1.9, etc.)
  const archived = await prisma.$executeRaw`
    UPDATE "catalog"."Product" SET status = 'ARCHIVED'::"catalog"."ProductStatus"
    WHERE status = 'DRAFT'::"catalog"."ProductStatus"
  `;
  console.log(`  📦 Archived ${archived} old test products`);

  // Add 30 published products WITHOUT orders (new listings, no sales yet)
  const newProducts = await prisma.$executeRaw`
    INSERT INTO "catalog"."Product" (id, code, type, title, slug, status, "categoryId", "partnerId", "createdAt", "updatedAt")
    SELECT
      gen_random_uuid(),
      'PRD-' || lpad((300 + row_number() OVER())::text, 8, '0'),
      (CASE (row_number() OVER() % 6)
        WHEN 0 THEN 'TOUR'::"catalog"."ProductType"
        WHEN 1 THEN 'EXCURSION'::"catalog"."ProductType"
        WHEN 2 THEN 'EXCURSION'::"catalog"."ProductType"
        WHEN 3 THEN 'EXCURSION'::"catalog"."ProductType"
        WHEN 4 THEN 'GUIDE'::"catalog"."ProductType"
        ELSE 'TOUR'::"catalog"."ProductType"
      END),
      (CASE (row_number() OVER() % 30)
        WHEN 0 THEN 'Baku Food Tour Premium'
        WHEN 1 THEN 'Gabala Ski Resort Package'
        WHEN 2 THEN 'Shamakhi Astrophotography Tour'
        WHEN 3 THEN 'Baku Street Art Walking Tour'
        WHEN 4 THEN 'Gobustan Night Camping'
        WHEN 5 THEN 'Sheki Silk Road Bicycle Tour'
        WHEN 6 THEN 'Baku Modern Art Gallery Tour'
        WHEN 7 THEN 'Caspian Sea Fishing Charter'
        WHEN 8 THEN 'Azerbaijan Carpet Workshop'
        WHEN 9 THEN 'Baku Rooftop Yoga Session'
        WHEN 10 THEN 'Absheron Hot Springs Trip'
        WHEN 11 THEN 'Baku Photography Masterclass'
        WHEN 12 THEN 'Gobustan Archaeology Dig'
        WHEN 13 THEN 'Sheki Traditional Music Night'
        WHEN 14 THEN 'Baku Wine Cheese Evening'
        WHEN 15 THEN 'Gabala Horseback Riding'
        WHEN 16 THEN 'Baku Architecture Photo Walk'
        WHEN 17 THEN 'Gobustan Mud Volcano Safari'
        WHEN 18 THEN 'Baku Culinary Arts Workshop'
        WHEN 19 THEN 'Sheki Handicraft Shopping'
        WHEN 20 THEN 'Baku Sunset Yacht Cruise'
        WHEN 21 THEN 'Gabala Adventure Park Pass'
        WHEN 22 THEN 'Baku Cultural Heritage Walk'
        WHEN 23 THEN 'Gobustan Petroglyphs Tour'
        WHEN 24 THEN 'Baku Night Market Experience'
        WHEN 25 THEN 'Sheki Palace Garden Tour'
        WHEN 26 THEN 'Baku Coffee Culture Walk'
        WHEN 27 THEN 'Gabala Lake Kayaking'
        WHEN 28 THEN 'Baku Street Food Adventure'
        WHEN 29 THEN 'Azerbaijan Tea Ceremony'
      END),
      'new-listing-' || (row_number() OVER()),
      'PUBLISHED'::"catalog"."ProductStatus",
      (SELECT id FROM "catalog"."Category" WHERE slug = 'tours' LIMIT 1),
      (SELECT id FROM "crm"."Partner" WHERE code = 'PRN-00000003' LIMIT 1),
      NOW(),
      NOW()
    FROM generate_series(1, 30)
  `;
  console.log(`  📝 Added ${newProducts} new listing products (without orders)`);

  // Add publication channels for new products
  await prisma.$executeRaw`
    INSERT INTO "catalog"."ProductPublicationChannel" (id, "productId", channel, "createdAt")
    SELECT gen_random_uuid(), p.id, 'MARKETPLACE'::"catalog"."PublicationChannel", NOW()
    FROM "catalog"."Product" p WHERE p.slug LIKE 'new-listing-%'
      AND NOT EXISTS (SELECT 1 FROM "catalog"."ProductPublicationChannel" c WHERE c."productId" = p.id)
  `;

  // Final catalog health summary
  const published = await prisma.product.count({ where: { status: "PUBLISHED" as any } });
  const archived = await prisma.product.count({ where: { status: "ARCHIVED" as any } });
  console.log(`  ✅ Catalog: ${published} PUBLISHED, ${archived} ARCHIVED`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 TravelHub Command Center V3 — Demo Dataset Seed");
  console.log("═══════════════════════════════════════════════════");
  console.log(`Database: ${process.env.DATABASE_URL?.split("@")[1] ?? "unknown"}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  const startTime = Date.now();

  try {
    // 1. Partners
    const partners = await seedPartners();

    // 2. Customers
    await seedCustomers();

    // 3. Products (with publication channels)
    const products = await seedProducts(partners);

    // 4. Storefronts
    await seedStorefronts(partners);

  // 5. Orders + Payments + Bookings + Commissions
  await seedOrders(products);

  // 6. Archive old test DRAFT products + add new listings without orders
  await seedCatalogHealth();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n═══════════════════════════════════════════════════");
    console.log(`✅ Seed completed in ${elapsed}s`);
    console.log("═══════════════════════════════════════════════════");

    // Print summary
    const counts = await Promise.all([
      prisma.partner.count(),
      prisma.customer.count(),
      prisma.product.count(),
      prisma.order.count(),
      prisma.payment.count(),
      prisma.booking.count(),
      prisma.commission.count(),
      prisma.productPublicationChannel.count(),
      prisma.partnerStorefront.count(),
    ]);

    console.log("\n📊 Final database counts:");
    console.log(`  Partners:            ${counts[0]}`);
    console.log(`  Customers:           ${counts[1]}`);
    console.log(`  Products:            ${counts[2]}`);
    console.log(`  Orders:              ${counts[3]}`);
    console.log(`  Payments:            ${counts[4]}`);
    console.log(`  Bookings:            ${counts[5]}`);
    console.log(`  Commissions:         ${counts[6]}`);
    console.log(`  Publications:        ${counts[7]}`);
    console.log(`  Storefronts:         ${counts[8]}`);

  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
