CREATE TABLE "ProductoMip" (
  "id" SERIAL NOT NULL,
  "nombreComercial" TEXT NOT NULL,
  "principioActivo" TEXT NOT NULL,
  "concentracion" TEXT NOT NULL,
  "organismoHabilitante" TEXT NOT NULL,
  "tipoRegistro" TEXT NOT NULL,
  "numeroRegistro" TEXT NOT NULL,
  "usoPrincipal" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductoMip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductoMip_activo_idx" ON "ProductoMip"("activo");
CREATE INDEX "ProductoMip_nombreComercial_idx" ON "ProductoMip"("nombreComercial");

INSERT INTO "ProductoMip" ("nombreComercial", "principioActivo", "concentracion", "organismoHabilitante", "tipoRegistro", "numeroRegistro", "usoPrincipal") VALUES
('Fendona 6 SC', 'Alfacipermetrina', '6%', 'ANMAT', 'RNPUD', '0250058', 'MIP'),
('K-Othrina', 'Deltametrina', '2,5%', 'ANMAT', 'RNPUD', '0250006', 'MIP'),
('Aqua K-Othrine', 'Deltametrina', '2%', 'ANMAT', 'RNPUD', '0250052', 'MIP'),
('Solfac EW 50', 'Cyfluthrin', '5%', 'ANMAT', 'RNPUD', '0250005', 'MIP'),
('Blattanex Gel', 'Fipronil', '0,05%', 'ANMAT', 'RNPUD', '0250034', 'MIP'),
('Maxforce Gel', 'Imidacloprid', '2,15%', 'ANMAT', 'RNPUD', '0250044', 'MIP'),
('Klerat', 'Brodifacoum', '0,005%', 'ANMAT', 'RNPUD', '0250012', 'MIP'),
('Storm', 'Flocoumafen', '0,005%', 'ANMAT', 'RNPUD', '0250019', 'MIP'),
('Rodilon Bloque', 'Difethialone', '0,0025%', 'ANMAT', 'RNPUD', '0250071', 'MIP'),
('Mirex-S', 'Sulfluramida', '0,3%', 'SENASA', 'SENASA', '36.184', 'MIP')
ON CONFLICT DO NOTHING;
