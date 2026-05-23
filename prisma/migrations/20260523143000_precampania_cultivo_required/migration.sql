UPDATE "ProductoPrecampania"
SET "cultivo" = COALESCE(NULLIF(TRIM("cultivo"), ''), NULLIF(TRIM("categoria"), ''), 'Otro');

ALTER TABLE "ProductoPrecampania"
ALTER COLUMN "cultivo" SET DEFAULT 'Otro',
ALTER COLUMN "cultivo" SET NOT NULL;
