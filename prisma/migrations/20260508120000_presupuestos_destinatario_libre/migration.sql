-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Presupuesto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personaId" INTEGER,
    "nombreLibre" TEXT,
    "tipoDestinatario" TEXT NOT NULL DEFAULT 'EXISTENTE',
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
    CONSTRAINT "Presupuesto_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Presupuesto" ("aliasTransferencia", "createdAt", "datosBancarios", "descuentoTipo", "descuentoValor", "estado", "id", "observaciones", "personaId", "subtotal", "total", "updatedAt", "validez", "tipoDestinatario")
SELECT "aliasTransferencia", "createdAt", "datosBancarios", "descuentoTipo", "descuentoValor", "estado", "id", "observaciones", "personaId", "subtotal", "total", "updatedAt", "validez", 'EXISTENTE'
FROM "Presupuesto";
DROP TABLE "Presupuesto";
ALTER TABLE "new_Presupuesto" RENAME TO "Presupuesto";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
