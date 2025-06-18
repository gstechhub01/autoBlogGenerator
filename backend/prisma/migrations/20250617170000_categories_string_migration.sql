-- Migration SQL to convert BlogConfig.categories from JSON/array to string
-- This script assumes you are using PostgreSQL. Adjust for other DBs as needed.

-- 1. Add a temporary column for the new string category
ALTER TABLE "BlogConfig" ADD COLUMN "categories_temp" TEXT;

-- 2. Migrate data from the old JSON column to the new string column
UPDATE "BlogConfig"
SET "categories_temp" =
  CASE
    WHEN jsonb_typeof("categories") = 'string' THEN "categories"::text
    WHEN jsonb_typeof("categories") = 'array' THEN ("categories"->>0)
    WHEN jsonb_typeof("categories") = 'object' THEN NULL -- or handle as needed
    ELSE NULL
  END;

-- 3. Drop the old column and rename the new one
ALTER TABLE "BlogConfig" DROP COLUMN "categories";
ALTER TABLE "BlogConfig" RENAME COLUMN "categories_temp" TO "categories";

-- 4. (Optional) If you want to enforce NOT NULL, add:
-- ALTER TABLE "BlogConfig" ALTER COLUMN "categories" SET NOT NULL;
