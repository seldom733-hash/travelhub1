import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import * as path from "path";
import { HotelMatchingService } from "./hotel-matching.service";

/**
 * Best-effort photo backfill after a supplier catalog apply.
 *
 * The actual Tripadvisor CDN search/WebP download lives in the existing
 * `scripts/hotel-photo-catalog.ts` CLI (Bing/DDG discover Tripadvisor CDN
 * URLs; Tripadvisor HTML itself is DataDome-protected). Running that script is
 * deliberately asynchronous: a sync must not fail or hang because an image
 * provider is slow.
 */
@Injectable()
export class HotelPhotoSyncService {
  private readonly logger = new Logger(HotelPhotoSyncService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly hotelMatching: HotelMatchingService,
  ) {}

  async afterApply(supplierCode: string): Promise<void> {
    // Tests must not spawn a long-lived photo downloader.
    if (process.env.NODE_ENV === "test") return;
    if (this.running.has(supplierCode)) {
      this.logger.log(`Hotel photo backfill for ${supplierCode} is already running`);
      return;
    }
    this.running.add(supplierCode);
    try {
      // New catalog Products do not create Hotel/HotelSupplierRef rows by
      // themselves. Build/refresh the registry first, then let the photo CLI
      // process only this supplier's hotels.
      await this.hotelMatching.syncSupplierHotels(supplierCode);
      await this.runCli(supplierCode);
    } catch (error) {
      this.logger.warn(`Hotel photo backfill ${supplierCode} failed: ${(error as Error).message}`);
    } finally {
      this.running.delete(supplierCode);
    }
  }

  private runCli(supplierCode: string): Promise<void> {
    const backendRoot = path.resolve(__dirname, "../../../..");
    const script = path.join(backendRoot, "scripts", "hotel-photo-catalog.ts");
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    return new Promise((resolve) => {
      const child = spawn(
        npx,
        [
          "ts-node",
          "--transpile-only",
          script,
          `--supplier=${supplierCode}`,
          "--status=NONE,FAILED,OK",
          "--limit=2000",
        ],
        {
          cwd: backendRoot,
          stdio: "ignore",
          windowsHide: true,
          shell: true,
        },
      );
      child.once("error", (error) => {
        this.logger.warn(`Hotel photo CLI spawn failed: ${error.message}`);
        resolve();
      });
      child.once("exit", (code) => {
        if (code !== 0) this.logger.warn(`Hotel photo CLI exited with ${code} for ${supplierCode}`);
        resolve();
      });
    });
  }
}
