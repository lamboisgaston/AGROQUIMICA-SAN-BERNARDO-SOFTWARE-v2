-- CreateTable
CREATE TABLE "CuentaCorriente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personaId" INTEGER NOT NULL,
    "saldo" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CuentaCorriente_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimientoCuentaCorriente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuentaCorrienteId" INTEGER NOT NULL,
    "ventaId" INTEGER,
    "tipo" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "descripcion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoCuentaCorriente_cuentaCorrienteId_fkey" FOREIGN KEY ("cuentaCorrienteId") REFERENCES "CuentaCorriente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoCuentaCorriente_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaCorriente_personaId_key" ON "CuentaCorriente"("personaId");
