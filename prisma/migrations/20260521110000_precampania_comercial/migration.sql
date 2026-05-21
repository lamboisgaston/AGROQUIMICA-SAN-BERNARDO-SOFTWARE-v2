-- CreateTable
CREATE TABLE "EmpresaComercial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'LABORATORIO',
    "cuit" TEXT,
    "contactoComercial" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ListaComercial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresaComercialId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "vigenteDesde" DATETIME,
    "vigenteHasta" DATETIME,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListaComercial_empresaComercialId_fkey" FOREIGN KEY ("empresaComercialId") REFERENCES "EmpresaComercial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProductoListaComercial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listaComercialId" INTEGER NOT NULL,
    "skuExterno" TEXT,
    "nombreProducto" TEXT NOT NULL,
    "unidad" TEXT,
    "precioNeto" REAL NOT NULL DEFAULT 0,
    "precioSugeridoPublico" REAL,
    "descuentoPorcentaje" REAL NOT NULL DEFAULT 0,
    "bonificacionPorcentaje" REAL NOT NULL DEFAULT 0,
    "ivaPorcentaje" REAL NOT NULL DEFAULT 21,
    "fletePorcentaje" REAL NOT NULL DEFAULT 0,
    "margenPorcentaje" REAL NOT NULL DEFAULT 0,
    "financiacionPorcentaje" REAL NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductoListaComercial_listaComercialId_fkey" FOREIGN KEY ("listaComercialId") REFERENCES "ListaComercial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ReglaComercialLista" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listaComercialId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReglaComercialLista_listaComercialId_fkey" FOREIGN KEY ("listaComercialId") REFERENCES "ListaComercial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductoListaComercial_listaComercialId_nombreProducto_idx" ON "ProductoListaComercial"("listaComercialId", "nombreProducto");

ALTER TABLE "Venta" ADD COLUMN "tipoOperacion" TEXT NOT NULL DEFAULT 'MOSTRADOR';
ALTER TABLE "Venta" ADD COLUMN "listaComercialId" INTEGER REFERENCES "ListaComercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
