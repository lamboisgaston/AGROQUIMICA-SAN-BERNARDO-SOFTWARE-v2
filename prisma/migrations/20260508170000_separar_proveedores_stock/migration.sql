ALTER TABLE "Proveedor" RENAME COLUMN "nombre" TO "razonSocial";
ALTER TABLE "Proveedor" ADD COLUMN "mail" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "direccion" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "contactoComercial" TEXT;

ALTER TABLE "Producto" ADD COLUMN "stockMinimo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Producto" ADD COLUMN "ultimaActualizacionStock" DATETIME;
