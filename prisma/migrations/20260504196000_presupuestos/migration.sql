-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personaId" INTEGER NOT NULL,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "descuentoTipo" TEXT,
    "descuentoValor" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "validez" TEXT,
    "aliasTransferencia" TEXT,
    "datosBancarios" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Presupuesto_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PresupuestoItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "presupuestoId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "PresupuestoItem_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresupuestoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
