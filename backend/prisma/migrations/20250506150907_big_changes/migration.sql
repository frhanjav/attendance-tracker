/*
  Warnings:

  - A unique constraint covering the columns `[userId,streamId,subjectName,classDate,isReplacement]` on the table `AttendanceRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "AttendanceRecord_userId_streamId_subjectName_classDate_key";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "isReplacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalCourseCode" TEXT,
ADD COLUMN     "originalEndTime" TEXT,
ADD COLUMN     "originalStartTime" TEXT,
ADD COLUMN     "originalSubjectName" TEXT;

-- CreateIndex
CREATE INDEX "AttendanceRecord_isReplacement_idx" ON "AttendanceRecord"("isReplacement");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_streamId_subjectName_classDate_isRe_key" ON "AttendanceRecord"("userId", "streamId", "subjectName", "classDate", "isReplacement");
