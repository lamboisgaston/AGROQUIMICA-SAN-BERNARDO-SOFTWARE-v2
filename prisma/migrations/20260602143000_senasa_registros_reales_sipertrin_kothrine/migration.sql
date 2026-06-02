-- Completa los registros regulatorios reales conocidos para productos MIP usados en SENASA.
-- Actualiza por nombre comercial e inserta sólo si el producto no existe.
WITH base("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "habilitacionCompleta", "disposicionRegistro", "fechaVencimientoRegistro", "empresaTitularRegistro") AS (
  VALUES
    ('Sipertrin', 'Beta-cipermetrina', '0,5%', 'ANMAT', 'RNPUD', '0250075', 'ANMAT RNPUD N° 0250075', 'DI-2021-5216-APN-ANMAT#MS', '2026-06-23'::timestamp, 'Chemotecnica S.A. - RNE N° 020033120'),
    ('K-Othrina', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250079', 'ANMAT RNPUD N° 0250079', 'DI-2022-7452-APN-ANMAT#MS', '2026-10-03'::timestamp, 'Bayer S.A. - RNE N° 020032212'),
    ('K-Othrine', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250079', 'ANMAT RNPUD N° 0250079', 'DI-2022-7452-APN-ANMAT#MS', '2026-10-03'::timestamp, 'Bayer S.A. - RNE N° 020032212')
)
UPDATE "ProductoMip" p
SET "principioActivo" = base."principioActivo",
    "concentracion" = base."concentracion",
    "organismoHabilitante" = base."organismoHabilitante",
    "tipoRegistro" = base."tipoRegistro",
    "numeroRegistro" = base."numeroRegistro",
    "habilitacionCompleta" = base."habilitacionCompleta",
    "disposicionRegistro" = base."disposicionRegistro",
    "fechaVencimientoRegistro" = base."fechaVencimientoRegistro",
    "empresaTitularRegistro" = base."empresaTitularRegistro",
    "usoPrincipal" = 'MIP',
    "activo" = true
FROM base
WHERE lower(p."nombreComercial") = lower(base."nombreComercial");

WITH base("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "habilitacionCompleta", "disposicionRegistro", "fechaVencimientoRegistro", "empresaTitularRegistro") AS (
  VALUES
    ('Sipertrin', 'Beta-cipermetrina', '0,5%', 'ANMAT', 'RNPUD', '0250075', 'ANMAT RNPUD N° 0250075', 'DI-2021-5216-APN-ANMAT#MS', '2026-06-23'::timestamp, 'Chemotecnica S.A. - RNE N° 020033120'),
    ('K-Othrina', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250079', 'ANMAT RNPUD N° 0250079', 'DI-2022-7452-APN-ANMAT#MS', '2026-10-03'::timestamp, 'Bayer S.A. - RNE N° 020032212'),
    ('K-Othrine', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250079', 'ANMAT RNPUD N° 0250079', 'DI-2022-7452-APN-ANMAT#MS', '2026-10-03'::timestamp, 'Bayer S.A. - RNE N° 020032212')
)
INSERT INTO "ProductoMip" ("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "habilitacionCompleta", "disposicionRegistro", "fechaVencimientoRegistro", "empresaTitularRegistro", "usoPrincipal", "activo")
SELECT base."nombreComercial", base."principioActivo", base."concentracion", base."organismoHabilitante", base."tipoRegistro", base."numeroRegistro", base."habilitacionCompleta", base."disposicionRegistro", base."fechaVencimientoRegistro", base."empresaTitularRegistro", 'MIP', true
FROM base
WHERE NOT EXISTS (SELECT 1 FROM "ProductoMip" p WHERE lower(p."nombreComercial") = lower(base."nombreComercial"));
