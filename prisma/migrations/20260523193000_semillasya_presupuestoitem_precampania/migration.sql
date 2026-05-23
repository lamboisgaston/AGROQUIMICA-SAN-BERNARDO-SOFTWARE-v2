ALTER TABLE "PresupuestoItem" ADD COLUMN "productoPrecampaniaId" INTEGER;
ALTER TABLE "PresupuestoItem" ADD COLUMN "nombreProducto" TEXT;
ALTER TABLE "PresupuestoItem" ADD COLUMN "cultivo" TEXT;
ALTER TABLE "PresupuestoItem" ADD COLUMN "semillero" TEXT;
ALTER TABLE "PresupuestoItem" ADD COLUMN "presentacion" TEXT;
ALTER TABLE "PresupuestoItem" ADD COLUMN "observaciones" TEXT;

ALTER TABLE "PresupuestoItem" ALTER COLUMN "productoId" DROP NOT NULL;

ALTER TABLE "PresupuestoItem"
ADD CONSTRAINT "PresupuestoItem_productoPrecampaniaId_fkey"
FOREIGN KEY ("productoPrecampaniaId") REFERENCES "ProductoPrecampania"("id") ON DELETE SET NULL ON UPDATE CASCADE;
