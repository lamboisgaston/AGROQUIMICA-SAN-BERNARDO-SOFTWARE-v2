ALTER TABLE "ProductoPrecampania"
ADD COLUMN "descripcionTecnica" TEXT NOT NULL DEFAULT '',
ADD COLUMN "recomendacionesUso" TEXT NOT NULL DEFAULT '',
ADD COLUMN "epocaSiembra" TEXT NOT NULL DEFAULT '',
ADD COLUMN "dosisOrientativa" TEXT NOT NULL DEFAULT '',
ADD COLUMN "observacionesComerciales" TEXT NOT NULL DEFAULT '',
ADD COLUMN "imagenUrl" TEXT NOT NULL DEFAULT '';
