-- Rediseño de productos y precios con compatibilidad legacy
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "monedaCosto" TEXT NOT NULL DEFAULT 'USD',
    "costoBase" REAL NOT NULL DEFAULT 0,
    "porcentajeUva" REAL NOT NULL DEFAULT 0,
    "porcentajeFlete" REAL NOT NULL DEFAULT 0,
    "porcentajeGanancia" REAL NOT NULL DEFAULT 0,
    "precioFinalPesos" REAL NOT NULL DEFAULT 0,
    "precioUsd" REAL
);

INSERT INTO "new_Producto" (
  "id", "nombre", "categoria", "stock", "monedaCosto", "costoBase", "porcentajeUva", "porcentajeFlete", "porcentajeGanancia", "precioFinalPesos", "precioUsd"
)
SELECT
  "id",
  "nombre",
  "categoria",
  COALESCE("stock", 0),
  'USD',
  COALESCE("precioUsd", 0),
  0,
  0,
  0,
  0,
  "precioUsd"
FROM "Producto";

DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
