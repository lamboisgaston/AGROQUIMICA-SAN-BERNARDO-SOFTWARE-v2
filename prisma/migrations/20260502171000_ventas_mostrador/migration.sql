-- CreateTable
CREATE TABLE "Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personaId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Venta_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VentaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "VentaItem_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VentaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "VentaItem_ventaId_productoId_key" ON "VentaItem"("ventaId", "productoId");
