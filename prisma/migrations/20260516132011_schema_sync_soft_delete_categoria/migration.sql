/*
  Warnings:

  - You are about to drop the column `condicionPagoPrevista` on the `Presupuesto` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX IF EXISTS "MovimientoStock_productoId_createdAt_idx";

-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_CategoriaToProducto" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_CategoriaToProducto_A_fkey" FOREIGN KEY ("A") REFERENCES "Categoria" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_CategoriaToProducto_B_fkey" FOREIGN KEY ("B") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "telefonoEmergencia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "eliminadoAt" DATETIME,
    "eliminadoPor" TEXT,
    "motivoEliminacion" TEXT
);
INSERT INTO "new_Persona" ("contactoComercial", "cuitDni", "direccion", "id", "mail", "nombre", "observaciones", "telefono", "telefonoEmergencia", "tipo", "tipoCliente") SELECT "contactoComercial", "cuitDni", "direccion", "id", "mail", "nombre", "observaciones", "telefono", "telefonoEmergencia", "tipo", "tipoCliente" FROM "Persona";
DROP TABLE "Persona";
ALTER TABLE "new_Persona" RENAME TO "Persona";
CREATE TABLE "new_Presupuesto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personaId" INTEGER,
    "nombreLibre" TEXT,
    "tipoDestinatario" TEXT NOT NULL DEFAULT 'EXISTENTE',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "descuentoTipo" TEXT,
    "descuentoValor" REAL NOT NULL DEFAULT 0,
    "ajusteRedondeo" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "validez" TEXT,
    "aliasTransferencia" TEXT,
    "datosBancarios" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Presupuesto_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Presupuesto" ("ajusteRedondeo", "aliasTransferencia", "createdAt", "datosBancarios", "descuentoTipo", "descuentoValor", "estado", "id", "nombreLibre", "observaciones", "personaId", "subtotal", "tipoDestinatario", "total", "updatedAt", "validez") SELECT "ajusteRedondeo", "aliasTransferencia", "createdAt", "datosBancarios", "descuentoTipo", "descuentoValor", "estado", "id", "nombreLibre", "observaciones", "personaId", "subtotal", "tipoDestinatario", "total", "updatedAt", "validez" FROM "Presupuesto";
DROP TABLE "Presupuesto";
ALTER TABLE "new_Presupuesto" RENAME TO "Presupuesto";
CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "marca" TEXT NOT NULL DEFAULT '',
    "unidad" TEXT NOT NULL DEFAULT '',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "ultimaActualizacionStock" DATETIME,
    "monedaCosto" TEXT NOT NULL DEFAULT 'USD',
    "costoBase" REAL NOT NULL DEFAULT 0,
    "precioVenta" REAL NOT NULL DEFAULT 0,
    "porcentajeUva" REAL NOT NULL DEFAULT 0,
    "porcentajeFlete" REAL NOT NULL DEFAULT 0,
    "porcentajeGanancia" REAL NOT NULL DEFAULT 0,
    "precioFinalPesos" REAL NOT NULL DEFAULT 0,
    "precioUsd" REAL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "eliminadoAt" DATETIME,
    "eliminadoPor" TEXT,
    "motivoEliminacion" TEXT
);
INSERT INTO "new_Producto" ("categoria", "costoBase", "id", "marca", "monedaCosto", "nombre", "porcentajeFlete", "porcentajeGanancia", "porcentajeUva", "precioFinalPesos", "precioUsd", "precioVenta", "stock", "stockMinimo", "ultimaActualizacionStock", "unidad") SELECT "categoria", "costoBase", "id", "marca", "monedaCosto", "nombre", "porcentajeFlete", "porcentajeGanancia", "porcentajeUva", "precioFinalPesos", "precioUsd", "precioVenta", "stock", "stockMinimo", "ultimaActualizacionStock", "unidad" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
CREATE TABLE "new_Proveedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "razonSocial" TEXT NOT NULL,
    "cuit" TEXT,
    "telefono" TEXT,
    "mail" TEXT,
    "direccion" TEXT,
    "contactoComercial" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "eliminadoAt" DATETIME,
    "eliminadoPor" TEXT,
    "motivoEliminacion" TEXT
);
INSERT INTO "new_Proveedor" ("contactoComercial", "cuit", "direccion", "id", "mail", "observaciones", "razonSocial", "telefono") SELECT "contactoComercial", "cuit", "direccion", "id", "mail", "observaciones", "razonSocial", "telefono" FROM "Proveedor";
DROP TABLE "Proveedor";
ALTER TABLE "new_Proveedor" RENAME TO "Proveedor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "_CategoriaToProducto_AB_unique" ON "_CategoriaToProducto"("A", "B");

-- CreateIndex
CREATE INDEX "_CategoriaToProducto_B_index" ON "_CategoriaToProducto"("B");
