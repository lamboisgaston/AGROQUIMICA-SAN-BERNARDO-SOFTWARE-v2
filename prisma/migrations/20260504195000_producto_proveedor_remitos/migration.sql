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
INSERT INTO "new_Producto" ("id","nombre","categoria","stock","monedaCosto","costoBase","porcentajeUva","porcentajeFlete","porcentajeGanancia","precioFinalPesos","precioUsd")
SELECT "id","nombre","categoria","stock","monedaCosto","costoBase","porcentajeUva","porcentajeFlete","porcentajeGanancia","precioFinalPesos","precioUsd" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";

CREATE TABLE "ProductoProveedor" (
  "productoId" INTEGER NOT NULL,
  "proveedorId" INTEGER NOT NULL,
  PRIMARY KEY ("productoId","proveedorId"),
  CONSTRAINT "ProductoProveedor_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RemitoProveedor" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "proveedorId" INTEGER NOT NULL,
  "numeroRemito" TEXT NOT NULL,
  "fecha" DATETIME NOT NULL,
  "observaciones" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RemitoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DetalleRemitoProveedor" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "remitoId" INTEGER NOT NULL,
  "productoId" INTEGER NOT NULL,
  "cantidad" INTEGER NOT NULL,
  "costoCompra" REAL NOT NULL,
  "monedaCosto" TEXT NOT NULL,
  "ivaPorcentaje" REAL NOT NULL,
  "fletePorcentaje" REAL NOT NULL,
  "gananciaPorcentaje" REAL NOT NULL,
  CONSTRAINT "DetalleRemitoProveedor_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "RemitoProveedor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DetalleRemitoProveedor_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

PRAGMA foreign_keys=ON;
