/*
  Warnings:

  - You are about to drop the column `isReplacement` on the `AttendanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `originalCourseCode` on the `AttendanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `originalEndTime` on the `AttendanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `originalStartTime` on the `AttendanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `originalSubjectName` on the `AttendanceRecord` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OverrideType" AS ENUM ('CANCELLED', 'REPLACED');

-- DropIndex
DROP INDEX "AttendanceRecord_classDate_idx";

-- DropIndex
DROP INDEX "AttendanceRecord_isReplacement_idx";

-- DropIndex
DROP INDEX "AttendanceRecord_status_idx";

-- DropIndex
DROP INDEX "AttendanceRecord_streamId_idx";

-- DropIndex
DROP INDEX "AttendanceRecord_userId_idx";

-- AlterTable
ALTER TABLE "AttendanceRecord" DROP COLUMN "isReplacement",
DROP COLUMN "originalCourseCode",
DROP COLUMN "originalEndTime",
DROP COLUMN "originalStartTime",
DROP COLUMN "originalSubjectName";

-- CreateTable
CREATE TABLE "ClassOverride" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "classDate" TIMESTAMP(3) NOT NULL,
    "originalSubjectName" TEXT NOT NULL,
    "originalStartTime" TEXT,
    "overrideType" "OverrideType" NOT NULL,
    "replacementSubjectName" TEXT,
    "replacementCourseCode" TEXT,
    "replacementStartTime" TEXT,
    "replacementEndTime" TEXT,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassOverride_streamId_classDate_idx" ON "ClassOverride"("streamId", "classDate");

-- CreateIndex
CREATE UNIQUE INDEX "ClassOverride_streamId_classDate_originalSubjectName_origin_key" ON "ClassOverride"("streamId", "classDate", "originalSubjectName", "originalStartTime");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_streamId_classDate_status_idx" ON "AttendanceRecord"("userId", "streamId", "classDate", "status");

-- AddForeignKey
ALTER TABLE "ClassOverride" ADD CONSTRAINT "ClassOverride_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassOverride" ADD CONSTRAINT "ClassOverride_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
