CREATE TABLE "ReciboPagoCuentaCorriente" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "movimientoId" INTEGER NOT NULL,
  "personaId" INTEGER NOT NULL,
  "montoPagado" REAL NOT NULL,
  "medioPago" TEXT NOT NULL,
  "fechaPago" DATETIME NOT NULL,
  "observacion" TEXT,
  "saldoAnterior" REAL NOT NULL,
  "saldoPosterior" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReciboPagoCuentaCorriente_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "MovimientoCuentaCorriente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReciboPagoCuentaCorriente_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReciboPagoCuentaCorriente_movimientoId_key" ON "ReciboPagoCuentaCorriente"("movimientoId");
