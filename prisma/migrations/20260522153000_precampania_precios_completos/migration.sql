ALTER TABLE "ProductoPrecampania" ADD COLUMN "monedaCompra" TEXT NOT NULL DEFAULT 'ARS';
ALTER TABLE "ProductoPrecampania" ADD COLUMN "costoCompra" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "tipoCambio" REAL NOT NULL DEFAULT 1;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "porcentajeFlete" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "porcentajeIva" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "porcentajeMargen" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "precioVentaFinal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "precioManual" REAL;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "usaPrecioManual" BOOLEAN NOT NULL DEFAULT false;
