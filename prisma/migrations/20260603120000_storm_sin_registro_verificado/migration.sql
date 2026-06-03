-- Storm no tiene número RNPUD verificado cargado; debe mostrarse pendiente en PDF.
UPDATE "ProductoMip"
SET "numeroRegistro" = '',
    "habilitacionCompleta" = "organismoHabilitante" || CASE WHEN "tipoRegistro" <> '' AND lower("tipoRegistro") <> lower("organismoHabilitante") THEN ' ' || "tipoRegistro" ELSE '' END
WHERE lower("nombreComercial") = 'storm';
