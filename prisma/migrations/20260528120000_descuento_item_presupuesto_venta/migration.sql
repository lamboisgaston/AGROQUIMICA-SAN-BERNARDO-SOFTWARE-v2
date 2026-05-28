ALTER TABLE "PresupuestoItem" ADD COLUMN "descuentoPorcentaje" REAL NOT NULL DEFAULT 0;
ALTER TABLE "PresupuestoItem" ADD COLUMN "descuentoMonto" REAL NOT NULL DEFAULT 0;
ALTER TABLE "PresupuestoItem" ADD COLUMN "subtotalBruto" REAL NOT NULL DEFAULT 0;
ALTER TABLE "PresupuestoItem" ADD COLUMN "subtotalFinal" REAL NOT NULL DEFAULT 0;

UPDATE "PresupuestoItem"
SET "subtotalBruto" = COALESCE("precioUnitario", 0) * COALESCE("cantidad", 0),
    "subtotalFinal" = COALESCE("subtotal", 0),
    "descuentoMonto" = CASE
      WHEN (COALESCE("precioUnitario", 0) * COALESCE("cantidad", 0)) - COALESCE("subtotal", 0) > 0
      THEN (COALESCE("precioUnitario", 0) * COALESCE("cantidad", 0)) - COALESCE("subtotal", 0)
      ELSE 0
    END;

ALTER TABLE "VentaItem" ADD COLUMN "descuentoPorcentaje" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VentaItem" ADD COLUMN "descuentoMonto" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VentaItem" ADD COLUMN "subtotalBruto" REAL NOT NULL DEFAULT 0;
ALTER TABLE "VentaItem" ADD COLUMN "subtotalFinal" REAL NOT NULL DEFAULT 0;

UPDATE "VentaItem"
SET "subtotalBruto" = COALESCE("precioUnitario", 0) * COALESCE("cantidad", 0),
    "subtotalFinal" = COALESCE("subtotal", 0),
    "descuentoMonto" = CASE
      WHEN (COALESCE("precioUnitario", 0) * COALESCE("cantidad", 0)) - COALESCE("subtotal", 0) > 0
      THEN (COALESCE("precioUnitario", 0) * COALESCE("cantidad", 0)) - COALESCE("subtotal", 0)
      ELSE 0
    END;
