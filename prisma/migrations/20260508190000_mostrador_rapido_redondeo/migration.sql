-- AlterTable
ALTER TABLE "Persona" ADD COLUMN "mail" TEXT;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN "ajusteRedondeo" REAL NOT NULL DEFAULT 0;
