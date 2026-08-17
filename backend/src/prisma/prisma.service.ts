import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * PrismaService — единый клиент multiSchema БД (events, catalog, crm, order, booking).
 * Междоменные ссылки — только по ID, без FK между схемами.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /**
   * Выделенный клиент для аллокации BusinessSequence (Step 2.17B, Workstream B).
   * Лock-сэмплер доказал: in-tx upsert держит tuple+transactionid lock строки
   * BusinessSequence до commit доменной транзакции (80/80 сэмплов на conc 50).
   * Аллокация вынесена на собственный клиент (одиночный autocommit upsert) —
   * lock держится только ~2ms.
   */
  readonly seqClient: PrismaClient;

  constructor() {
    // Step 2.17B remediation — connection pool is a proven bottleneck under
    // qualification concurrency (pg.Pool default max=10 serialized 50 concurrent
    // payment/booking chains). Pool size is now canonical configurable via
    // DATABASE_POOL_SIZE (default 20). Budget: PG max_connections=100 in the
    // qualification environment; 2 app + 2 worker instances × (20 + 3 seq) = 92
    // leaves headroom for migrations/admin connections.
    const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? 20);
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 20,
      }),
    });
    const seqPoolSize = Number(process.env.DATABASE_SEQ_POOL_SIZE ?? 3);
    this.seqClient = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: Number.isFinite(seqPoolSize) && seqPoolSize > 0 ? seqPoolSize : 3,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.seqClient.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.seqClient.$disconnect();
  }
}
