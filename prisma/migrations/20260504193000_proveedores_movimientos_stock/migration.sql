-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "proveedorId" INTEGER;

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "cuit" TEXT,
    "observaciones" TEXT
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Producto_proveedorId_idx" ON "Producto"("proveedorId");

-- CreateIndex
CREATE INDEX "MovimientoStock_productoId_createdAt_idx" ON "MovimientoStock"("productoId", "createdAt");

-- AddForeignKey
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "proveedorId" INTEGER,
    "monedaCosto" TEXT NOT NULL DEFAULT 'USD',
    "costoBase" REAL NOT NULL DEFAULT 0,
    "porcentajeUva" REAL NOT NULL DEFAULT 0,
    "porcentajeFlete" REAL NOT NULL DEFAULT 0,
    "porcentajeGanancia" REAL NOT NULL DEFAULT 0,
    "precioFinalPesos" REAL NOT NULL DEFAULT 0,
    "precioUsd" REAL,
    CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Producto" ("id","nombre","categoria","stock","monedaCosto","costoBase","porcentajeUva","porcentajeFlete","porcentajeGanancia","precioFinalPesos","precioUsd")
SELECT "id","nombre","categoria","stock","monedaCosto","costoBase","porcentajeUva","porcentajeFlete","porcentajeGanancia","precioFinalPesos","precioUsd" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
PRAGMA foreign_keys=ON;
