-- CreateTable
CREATE TABLE "EstadisticaHistorica" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "etiquetaOriginal" TEXT,
    "ventasArs" DOUBLE PRECISION,
    "recTransferenciaArs" DOUBLE PRECISION,
    "sinRespaldoArs" DOUBLE PRECISION,
    "facContadoArs" DOUBLE PRECISION,
    "facBContadoArs" DOUBLE PRECISION,
    "fcCuentaCorrienteArs" DOUBLE PRECISION,
    "ffArs" DOUBLE PRECISION,
    "facturadoArs" DOUBLE PRECISION,
    "comprasArs" DOUBLE PRECISION,
    "dolarBnaVenta" DOUBLE PRECISION,
    "ventasUsd" DOUBLE PRECISION,
    "comprasUsd" DOUBLE PRECISION,
    "facturadoUsd" DOUBLE PRECISION,
    "margenBrutoArs" DOUBLE PRECISION,
    "margenBrutoUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstadisticaHistorica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionDolar" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'BNA',
    "dolarBnaVenta" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotizacionDolar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstadisticaHistorica_fecha_key" ON "EstadisticaHistorica"("fecha");
CREATE INDEX "EstadisticaHistorica_fecha_idx" ON "EstadisticaHistorica"("fecha");
CREATE UNIQUE INDEX "CotizacionDolar_fecha_fuente_key" ON "CotizacionDolar"("fecha", "fuente");
CREATE INDEX "CotizacionDolar_fecha_idx" ON "CotizacionDolar"("fecha");
