-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "isReplacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalCourseCode" TEXT,
ADD COLUMN     "originalEndTime" TEXT,
ADD COLUMN     "originalStartTime" TEXT,
ADD COLUMN     "originalSubjectName" TEXT;

-- CreateIndex
CREATE INDEX "AttendanceRecord_isReplacement_idx" ON "AttendanceRecord"("isReplacement");
