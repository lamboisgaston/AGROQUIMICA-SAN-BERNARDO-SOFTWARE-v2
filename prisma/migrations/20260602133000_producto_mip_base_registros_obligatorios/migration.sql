-- Reafirma la base MIP exigida para reportes SENASA/ANMAT con registro completo.
-- No borra productos existentes: actualiza por nombre comercial e inserta sólo faltantes.
WITH base("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "habilitacionCompleta") AS (
  VALUES
    ('Storm', 'Flocoumafen', '0,005%', 'ANMAT', 'RNPUD', '0250019', 'ANMAT RNPUD N° 0250019'),
    ('Fendona 6 SC', 'Alfacipermetrina', '6%', 'ANMAT', 'RNPUD', '0250058', 'ANMAT RNPUD N° 0250058'),
    ('K-Othrina', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250006', 'ANMAT RNPUD N° 0250006'),
    ('Aqua K-Othrine', 'Deltametrina', '2%', 'ANMAT', 'RNPUD', '0250052', 'ANMAT RNPUD N° 0250052'),
    ('Solfac EW 50', 'Cyfluthrin', '5%', 'ANMAT', 'RNPUD', '0250005', 'ANMAT RNPUD N° 0250005'),
    ('Blattanex Gel', 'Fipronil', '0,05%', 'ANMAT', 'RNPUD', '0250034', 'ANMAT RNPUD N° 0250034'),
    ('Maxforce Gel', 'Imidacloprid', '2,15%', 'ANMAT', 'RNPUD', '0250044', 'ANMAT RNPUD N° 0250044'),
    ('Klerat', 'Brodifacoum', '0,005%', 'ANMAT', 'RNPUD', '0250012', 'ANMAT RNPUD N° 0250012'),
    ('Rodilon Bloque', 'Difethialone', '0,0025%', 'ANMAT', 'RNPUD', '0250071', 'ANMAT RNPUD N° 0250071'),
    ('Mirex-S', 'Sulfluramida', '0,3%', 'SENASA', 'SENASA', '36.184', 'SENASA N° 36.184')
)
UPDATE "ProductoMip" p
SET "principioActivo" = base."principioActivo",
    "concentracion" = base."concentracion",
    "organismoHabilitante" = base."organismoHabilitante",
    "tipoRegistro" = base."tipoRegistro",
    "numeroRegistro" = base."numeroRegistro",
    "habilitacionCompleta" = base."habilitacionCompleta",
    "usoPrincipal" = 'MIP',
    "activo" = true
FROM base
WHERE lower(p."nombreComercial") = lower(base."nombreComercial");

WITH base("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "habilitacionCompleta") AS (
  VALUES
    ('Storm', 'Flocoumafen', '0,005%', 'ANMAT', 'RNPUD', '0250019', 'ANMAT RNPUD N° 0250019'),
    ('Fendona 6 SC', 'Alfacipermetrina', '6%', 'ANMAT', 'RNPUD', '0250058', 'ANMAT RNPUD N° 0250058'),
    ('K-Othrina', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250006', 'ANMAT RNPUD N° 0250006'),
    ('Aqua K-Othrine', 'Deltametrina', '2%', 'ANMAT', 'RNPUD', '0250052', 'ANMAT RNPUD N° 0250052'),
    ('Solfac EW 50', 'Cyfluthrin', '5%', 'ANMAT', 'RNPUD', '0250005', 'ANMAT RNPUD N° 0250005'),
    ('Blattanex Gel', 'Fipronil', '0,05%', 'ANMAT', 'RNPUD', '0250034', 'ANMAT RNPUD N° 0250034'),
    ('Maxforce Gel', 'Imidacloprid', '2,15%', 'ANMAT', 'RNPUD', '0250044', 'ANMAT RNPUD N° 0250044'),
    ('Klerat', 'Brodifacoum', '0,005%', 'ANMAT', 'RNPUD', '0250012', 'ANMAT RNPUD N° 0250012'),
    ('Rodilon Bloque', 'Difethialone', '0,0025%', 'ANMAT', 'RNPUD', '0250071', 'ANMAT RNPUD N° 0250071'),
    ('Mirex-S', 'Sulfluramida', '0,3%', 'SENASA', 'SENASA', '36.184', 'SENASA N° 36.184')
)
INSERT INTO "ProductoMip" ("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "habilitacionCompleta", "usoPrincipal", "activo")
SELECT base."nombreComercial", base."principioActivo", base."concentracion", base."organismoHabilitante", base."tipoRegistro", base."numeroRegistro", base."habilitacionCompleta", 'MIP', true
FROM base
WHERE NOT EXISTS (SELECT 1 FROM "ProductoMip" p WHERE lower(p."nombreComercial") = lower(base."nombreComercial"));
