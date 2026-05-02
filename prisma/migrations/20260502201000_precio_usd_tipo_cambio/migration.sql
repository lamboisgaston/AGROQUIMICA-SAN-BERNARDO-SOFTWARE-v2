-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precioUsd" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Producto" ("categoria", "id", "nombre", "precioUsd", "stock")
SELECT "categoria", "id", "nombre", "precio", "stock" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";

CREATE TABLE "ConfiguracionGlobal" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "tipoCambioActual" REAL NOT NULL DEFAULT 1
);
INSERT INTO "ConfiguracionGlobal" ("id", "tipoCambioActual") VALUES (1, 1);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
