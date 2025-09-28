/*
  Warnings:

  - A unique constraint covering the columns `[userId,streamId,subjectName,classDate,subjectIndex,isReplacement]` on the table `AttendanceRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `subjectIndex` to the `AttendanceRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add subjectIndex with default value first
ALTER TABLE "AttendanceRecord" ADD COLUMN "subjectIndex" INTEGER NOT NULL DEFAULT 0;

-- Update existing records to have proper subjectIndex values
-- For records with the same (userId, streamId, subjectName, classDate), assign incrementing indices
WITH ranked_records AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "streamId", "subjectName", "classDate", "isReplacement"
            ORDER BY "markedAt" ASC
        ) - 1 AS new_subject_index
    FROM "AttendanceRecord"
)
UPDATE "AttendanceRecord"
SET "subjectIndex" = ranked_records.new_subject_index
FROM ranked_records
WHERE "AttendanceRecord".id = ranked_records.id;

-- Remove the default value
ALTER TABLE "AttendanceRecord" ALTER COLUMN "subjectIndex" DROP DEFAULT;

-- DropIndex (old unique constraint)
DROP INDEX "AttendanceRecord_userId_streamId_subjectName_classDate_isRe_key";

-- CreateIndex (new unique constraint with subjectIndex)
CREATE UNIQUE INDEX "AttendanceRecord_userId_streamId_subjectName_classDate_subje_key" ON "AttendanceRecord"("userId", "streamId", "subjectName", "classDate", "subjectIndex", "isReplacement");