-- Separación real de SemillasYa: semillero/distribuidor != marca comercial.
CREATE TABLE "Semillero" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "contacto" TEXT NOT NULL DEFAULT '',
    "observaciones" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Semillero_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Marca" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "descripcion" TEXT NOT NULL DEFAULT '',
    "pais" TEXT NOT NULL DEFAULT '',
    "semilleroId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Semillero_nombre_key" ON "Semillero"("nombre");
CREATE UNIQUE INDEX "Marca_nombre_key" ON "Marca"("nombre");
CREATE INDEX "Marca_semilleroId_idx" ON "Marca"("semilleroId");

ALTER TABLE "ProductoPrecampania" ADD COLUMN "semilleroId" INTEGER;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "marcaId" INTEGER;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "marcaComercial" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProductoPrecampania" ADD COLUMN "unidad" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProductoPrecampania" ADD COLUMN "tipoEnvase" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProductoPrecampania" ADD COLUMN "origen" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProductoPrecampania" ADD COLUMN "precioUsd" DOUBLE PRECISION;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "agotado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "novedad" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "hibrido" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductoPrecampania" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProductoPrecampania" ADD COLUMN "metadataTecnica" TEXT NOT NULL DEFAULT '{}';

CREATE INDEX "ProductoPrecampania_semilleroId_idx" ON "ProductoPrecampania"("semilleroId");
CREATE INDEX "ProductoPrecampania_marcaId_idx" ON "ProductoPrecampania"("marcaId");
CREATE INDEX "ProductoPrecampania_cultivo_marcaComercial_nombre_presentacionEnvase_idx" ON "ProductoPrecampania"("cultivo", "marcaComercial", "nombre", "presentacionEnvase");

ALTER TABLE "Marca" ADD CONSTRAINT "Marca_semilleroId_fkey" FOREIGN KEY ("semilleroId") REFERENCES "Semillero"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductoPrecampania" ADD CONSTRAINT "ProductoPrecampania_semilleroId_fkey" FOREIGN KEY ("semilleroId") REFERENCES "Semillero"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductoPrecampania" ADD CONSTRAINT "ProductoPrecampania_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Semillero" ("nombre", "logo", "observaciones", "updatedAt")
VALUES
  ('CAPS', '/app/assets/semilleros/caps.svg', 'Semillero/distribuidor; puede comercializar múltiples marcas.', CURRENT_TIMESTAMP),
  ('GUASCH', '/app/assets/semilleros/guasch.svg', 'Semillero/distribuidor.', CURRENT_TIMESTAMP),
  ('G.G.CH.', '/app/assets/semilleros/garden-gasty-chuchuy.svg', 'Garde, Giusti y Chuchuy SA. Lista de precios N°137 Mayo 2026.', CURRENT_TIMESTAMP)
ON CONFLICT ("nombre") DO NOTHING;

INSERT INTO "Marca" ("nombre", "semilleroId", "descripcion", "updatedAt")
SELECT marca.nombre, s.id, 'Marca comercial visible en SemillasYa', CURRENT_TIMESTAMP
FROM (VALUES
  ('Sais Italia'), ('G.G.Ch.'), ('Clause'), ('Tozer'), ('Harris Moran'), ('Niagara'), ('Nirit'), ('Daehnfeldt'),
  ('Syngenta'), ('Starke Ayres'), ('Cora Seeds'), ('Vilmorin'), ('Hed Seeds'), ('Hazera'), ('Yuksel'),
  ('Harmoniz'), ('Apricus Seeds'), ('Pennington Seeds'), ('Hollar'), ('Amsa'), ('Mikado'), ('Isi'), ('Japon'), ('U.S. Agriseeds'),
  ('CAPS'), ('Bonanza'), ('Mediterránea'), ('GUASCH')
) AS marca(nombre)
LEFT JOIN "Semillero" s ON s."nombre" = 'G.G.CH.'
ON CONFLICT ("nombre") DO NOTHING;

UPDATE "ProductoPrecampania" p
SET "semilleroId" = s."id",
    "marcaComercial" = CASE WHEN COALESCE(p."marcaComercial", '') = '' THEN p."semilleroLaboratorio" ELSE p."marcaComercial" END
FROM "Semillero" s
WHERE UPPER(TRIM(p."semilleroLaboratorio")) = UPPER(TRIM(s."nombre"));

UPDATE "ProductoPrecampania" p
SET "marcaId" = m."id"
FROM "Marca" m
WHERE UPPER(TRIM(p."marcaComercial")) = UPPER(TRIM(m."nombre"));
