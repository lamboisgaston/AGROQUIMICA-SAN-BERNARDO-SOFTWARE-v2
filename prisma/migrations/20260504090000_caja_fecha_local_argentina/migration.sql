-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CierreCajaDiario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "fechaCaja" TEXT NOT NULL,
    "totalEfectivo" REAL NOT NULL,
    "totalTransferencia" REAL NOT NULL,
    "totalTarjeta" REAL NOT NULL,
    "totalCuentaCorriente" REAL NOT NULL,
    "totalGeneral" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CierreCajaDiario" ("createdAt", "fecha", "id", "totalCuentaCorriente", "totalEfectivo", "totalGeneral", "totalTarjeta", "totalTransferencia", "fechaCaja")
SELECT "createdAt", "fecha", "id", "totalCuentaCorriente", "totalEfectivo", "totalGeneral", "totalTarjeta", "totalTransferencia", strftime('%Y-%m-%d', datetime("fecha", '-3 hours'))
FROM "CierreCajaDiario";
DROP TABLE "CierreCajaDiario";
ALTER TABLE "new_CierreCajaDiario" RENAME TO "CierreCajaDiario";
CREATE UNIQUE INDEX "CierreCajaDiario_fecha_key" ON "CierreCajaDiario"("fecha");
CREATE UNIQUE INDEX "CierreCajaDiario_fechaCaja_key" ON "CierreCajaDiario"("fechaCaja");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
