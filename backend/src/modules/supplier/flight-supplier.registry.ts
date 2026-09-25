import { Injectable, NotFoundException } from "@nestjs/common";
import type { FlightSupplier } from "./azal/flight.supplier";

@Injectable()
export class FlightSupplierRegistry {
  private readonly suppliers = new Map<string, FlightSupplier>();

  register(supplier: FlightSupplier): void {
    const code = supplier.code.trim().toUpperCase();

    if (!code) {
      throw new Error("Flight supplier code must not be empty");
    }

    if (this.suppliers.has(code)) {
      throw new Error(`Flight supplier already registered: ${code}`);
    }

    this.suppliers.set(code, supplier);
  }

  get(code: string): FlightSupplier {
    const normalizedCode = code.trim().toUpperCase();
    const supplier = this.suppliers.get(normalizedCode);

    if (!supplier) {
      throw new NotFoundException(
        `Flight supplier not found: ${normalizedCode}`,
      );
    }

    return supplier;
  }

  has(code: string): boolean {
    return this.suppliers.has(code.trim().toUpperCase());
  }

  list(): string[] {
    return [...this.suppliers.keys()];
  }
}
