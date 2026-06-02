ALTER TABLE "ProductoMip" ADD COLUMN IF NOT EXISTS "disposicionRegistro" TEXT;
ALTER TABLE "ProductoMip" ADD COLUMN IF NOT EXISTS "fechaResolucionSenasa" TIMESTAMP(3);
ALTER TABLE "ProductoMip" ADD COLUMN IF NOT EXISTS "fechaVencimientoRegistro" TIMESTAMP(3);
ALTER TABLE "ProductoMip" ADD COLUMN IF NOT EXISTS "empresaTitularRegistro" TEXT;
ALTER TABLE "ProductoMip" ADD COLUMN IF NOT EXISTS "observacionesRegulatorias" TEXT;

UPDATE "ProductoMip"
SET "numeroRegistro" = '0250079',
    "tipoRegistro" = 'RNPUD',
    "disposicionRegistro" = 'DI-2022-7452-APN-ANMAT#MS'
WHERE lower("nombreComercial") = lower('K-Othrina');

UPDATE "ProductoMip"
SET "tipoRegistro" = '',
    "numeroRegistro" = '',
    "disposicionRegistro" = NULL
WHERE lower("nombreComercial") = lower('Storm');

INSERT INTO "ProductoMip" ("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "disposicionRegistro", "usoPrincipal", "activo")
SELECT 'Sipertrin', 'Cipermetrina', '', 'ANMAT', 'RNPUD', '0250075', 'DI-2021-5216-APN-ANMAT#MS', 'MIP', true
WHERE NOT EXISTS (SELECT 1 FROM "ProductoMip" WHERE lower("nombreComercial") = lower('Sipertrin'));
