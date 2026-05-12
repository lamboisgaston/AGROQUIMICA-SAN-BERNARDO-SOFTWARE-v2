-- AlterTable
ALTER TABLE "Persona" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Persona" ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Persona" ADD COLUMN "eliminadoAt" DATETIME;
ALTER TABLE "Persona" ADD COLUMN "eliminadoPor" TEXT;
ALTER TABLE "Persona" ADD COLUMN "motivoEliminacion" TEXT;

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Proveedor" ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Proveedor" ADD COLUMN "eliminadoAt" DATETIME;
ALTER TABLE "Proveedor" ADD COLUMN "eliminadoPor" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "motivoEliminacion" TEXT;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Producto" ADD COLUMN "eliminado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Producto" ADD COLUMN "eliminadoAt" DATETIME;
ALTER TABLE "Producto" ADD COLUMN "eliminadoPor" TEXT;
ALTER TABLE "Producto" ADD COLUMN "motivoEliminacion" TEXT;
