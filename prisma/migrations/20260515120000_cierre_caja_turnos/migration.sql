-- RedefineTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CierreCajaDiario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "fechaCaja" TEXT NOT NULL,
    "turno" TEXT NOT NULL DEFAULT 'DIARIO',
    "cerradoPorRol" TEXT NOT NULL,
    "totalEfectivo" REAL NOT NULL,
    "totalTransferencia" REAL NOT NULL,
    "totalTarjeta" REAL NOT NULL,
    "totalCuentaCorriente" REAL NOT NULL,
    "totalGeneral" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CierreCajaDiario" ("createdAt", "fecha", "fechaCaja", "id", "totalCuentaCorriente", "totalEfectivo", "totalGeneral", "totalTarjeta", "totalTransferencia", "turno", "cerradoPorRol") SELECT "createdAt", "fecha", "fechaCaja", "id", "totalCuentaCorriente", "totalEfectivo", "totalGeneral", "totalTarjeta", "totalTransferencia", 'DIARIO', 'SIN_ROL' FROM "CierreCajaDiario";
DROP TABLE "CierreCajaDiario";
ALTER TABLE "new_CierreCajaDiario" RENAME TO "CierreCajaDiario";
CREATE UNIQUE INDEX "CierreCajaDiario_fechaCaja_turno_key" ON "CierreCajaDiario"("fechaCaja", "turno");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
