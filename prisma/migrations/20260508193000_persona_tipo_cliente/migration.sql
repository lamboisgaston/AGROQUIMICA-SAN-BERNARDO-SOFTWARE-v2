-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Persona" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "cuitDni" TEXT,
    "tipo" TEXT NOT NULL,
    "tipoCliente" TEXT NOT NULL DEFAULT 'PERSONAL',
    "mail" TEXT,
    "direccion" TEXT,
    "contactoComercial" TEXT,
    "observaciones" TEXT,
    "telefonoEmergencia" TEXT
);
INSERT INTO "new_Persona" ("cuitDni", "id", "mail", "nombre", "telefono", "tipo") SELECT "cuitDni", "id", "mail", "nombre", "telefono", "tipo" FROM "Persona";
DROP TABLE "Persona";
ALTER TABLE "new_Persona" RENAME TO "Persona";
CREATE UNIQUE INDEX "CuentaCorriente_personaId_key" ON "CuentaCorriente"("personaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
