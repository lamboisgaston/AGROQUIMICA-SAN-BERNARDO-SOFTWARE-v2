-- CreateTable
CREATE TABLE "ProductoPrecampania" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "semilleroLaboratorio" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "presentacionEnvase" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precioInternoManual" REAL,
    "estado" TEXT NOT NULL DEFAULT 'CONSULTAR',
    "publicadoWeb" BOOLEAN NOT NULL DEFAULT false,
    "visibleEnSemillasYa" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "ProductoPrecampania_visibleEnSemillasYa_activo_idx" ON "ProductoPrecampania"("visibleEnSemillasYa", "activo");
