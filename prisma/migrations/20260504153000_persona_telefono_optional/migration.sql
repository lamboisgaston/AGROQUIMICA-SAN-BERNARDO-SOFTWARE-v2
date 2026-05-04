PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Persona" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "cuitDni" TEXT,
    "tipo" TEXT NOT NULL
);

INSERT INTO "new_Persona" ("id", "nombre", "telefono", "cuitDni", "tipo")
SELECT "id", "nombre", "telefono", "cuitDni", "tipo" FROM "Persona";

DROP TABLE "Persona";
ALTER TABLE "new_Persona" RENAME TO "Persona";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
