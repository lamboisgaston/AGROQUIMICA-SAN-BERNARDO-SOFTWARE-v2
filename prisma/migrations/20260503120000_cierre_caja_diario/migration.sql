-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personaId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "total" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "medioPago" TEXT,
    CONSTRAINT "Venta_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Venta" ("createdAt", "estado", "id", "personaId", "total", "updatedAt") SELECT "createdAt", "estado", "id", "personaId", "total", "updatedAt" FROM "Venta";
DROP TABLE "Venta";
ALTER TABLE "new_Venta" RENAME TO "Venta";
CREATE TABLE "CierreCajaDiario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "totalEfectivo" REAL NOT NULL,
    "totalTransferencia" REAL NOT NULL,
    "totalTarjeta" REAL NOT NULL,
    "totalCuentaCorriente" REAL NOT NULL,
    "totalGeneral" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CierreCajaDiario_fecha_key" ON "CierreCajaDiario"("fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
