/**
 * PHASE 2 STEP 2.12A — PaymentProviderModule.
 *
 * Provider-neutral infrastructure module. Production configuration registers
 * NO provider (registry starts empty — no production PSP selected). The
 * test/fake provider is registered ONLY by test/e2e code via
 * `PaymentProviderRegistry.register(...)`; it is never provided by this
 * module, so production cannot select it by accident.
 */
import { Module } from "@nestjs/common";
import { PaymentProviderRegistry } from "./payment-provider.registry";

@Module({
  providers: [PaymentProviderRegistry],
  exports: [PaymentProviderRegistry],
})
export class PaymentProviderModule {}
