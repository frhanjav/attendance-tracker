/*
  Warnings:

  - A unique constraint covering the columns `[streamId,classDate,originalSubjectName,entryIndex]` on the table `ClassOverride` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `entryIndex` to the `ClassOverride` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ClassOverride_streamId_classDate_originalSubjectName_key";

-- AlterTable: Add entryIndex with default value first
ALTER TABLE "ClassOverride" ADD COLUMN "entryIndex" INTEGER NOT NULL DEFAULT 0;

-- Update existing records to have unique entryIndex values
-- For records with the same streamId, classDate, and originalSubjectName,
-- assign incrementing entryIndex values starting from 0
-- Uses same ordering logic as backend (originalStartTime, then createdAt as fallback)
WITH ranked_overrides AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "streamId", "classDate", "originalSubjectName"
            ORDER BY COALESCE("originalStartTime", '23:59:59') ASC, "createdAt" ASC
        ) - 1 AS new_entry_index
    FROM "ClassOverride"
)
UPDATE "ClassOverride" 
SET "entryIndex" = ranked_overrides.new_entry_index
FROM ranked_overrides 
WHERE "ClassOverride".id = ranked_overrides.id;

-- Remove the default value
ALTER TABLE "ClassOverride" ALTER COLUMN "entryIndex" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "ClassOverride_streamId_classDate_originalSubjectName_entryI_key" ON "ClassOverride"("streamId", "classDate", "originalSubjectName", "entryIndex");
