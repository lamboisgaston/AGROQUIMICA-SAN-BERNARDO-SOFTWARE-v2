ALTER TABLE "Producto" ADD COLUMN "principioActivo" TEXT;
ALTER TABLE "Producto" ADD COLUMN "resolucionSenasa" TEXT;
ALTER TABLE "Producto" ADD COLUMN "fechaResolucionSenasa" TIMESTAMP(3);
ALTER TABLE "Producto" ADD COLUMN "tipoSenasa" TEXT;
ALTER TABLE "Producto" ADD COLUMN "usoSenasa" TEXT;

CREATE TYPE "TipoDocumentoSenasa" AS ENUM ('AVISO_MIP', 'INFORME_CONTROL_PLAGAS');

CREATE TABLE "SenasaClienteConfig" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "establecimientoOficial" TEXT,
  "supervisor" TEXT,
  "responsableSiv" TEXT,
  "departamentoPartido" TEXT,
  "localidad" TEXT,
  "provincia" TEXT,
  "observaciones" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SenasaClienteConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SenasaResolucion" (
  "id" SERIAL NOT NULL,
  "productoId" INTEGER,
  "productoNombre" TEXT NOT NULL,
  "principioActivo" TEXT,
  "resolucionNumero" TEXT,
  "fechaResolucion" TIMESTAMP(3),
  "observaciones" TEXT,
  "archivoAdjuntoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SenasaResolucion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SenasaDocumento" (
  "id" SERIAL NOT NULL,
  "tipoDocumento" "TipoDocumentoSenasa" NOT NULL,
  "clienteId" INTEGER,
  "numeroCircular" TEXT,
  "fechaRecepcion" TIMESTAMP(3),
  "periodoDesde" TIMESTAMP(3),
  "periodoHasta" TIMESTAMP(3),
  "datosJson" JSONB NOT NULL,
  "esPlantilla" BOOLEAN NOT NULL DEFAULT false,
  "nombrePlantilla" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SenasaDocumento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SenasaClienteConfig_clienteId_key" ON "SenasaClienteConfig"("clienteId");
CREATE INDEX "SenasaDocumento_tipoDocumento_idx" ON "SenasaDocumento"("tipoDocumento");
CREATE INDEX "SenasaDocumento_clienteId_idx" ON "SenasaDocumento"("clienteId");
CREATE INDEX "SenasaDocumento_esPlantilla_idx" ON "SenasaDocumento"("esPlantilla");

ALTER TABLE "SenasaClienteConfig" ADD CONSTRAINT "SenasaClienteConfig_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SenasaResolucion" ADD CONSTRAINT "SenasaResolucion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SenasaDocumento" ADD CONSTRAINT "SenasaDocumento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
