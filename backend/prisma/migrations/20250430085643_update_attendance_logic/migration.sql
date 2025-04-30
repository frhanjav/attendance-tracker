/*
  Warnings:

  - The values [REPLACED,PENDING] on the enum `AttendanceStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `markedByUserId` on the `AttendanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `totalClasses` on the `BulkAttendanceEntry` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Timetable` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AttendanceStatus_new" AS ENUM ('OCCURRED', 'MISSED', 'CANCELLED');
ALTER TABLE "AttendanceRecord" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AttendanceRecord" ALTER COLUMN "status" TYPE "AttendanceStatus_new" USING ("status"::text::"AttendanceStatus_new");
ALTER TYPE "AttendanceStatus" RENAME TO "AttendanceStatus_old";
ALTER TYPE "AttendanceStatus_new" RENAME TO "AttendanceStatus";
DROP TYPE "AttendanceStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "AttendanceRecord" DROP COLUMN "markedByUserId",
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BulkAttendanceEntry" DROP COLUMN "totalClasses",
ADD COLUMN     "totalHeldClasses" INTEGER;

-- AlterTable
ALTER TABLE "Timetable" DROP COLUMN "updatedAt";

-- CreateIndex
CREATE INDEX "AttendanceRecord_status_idx" ON "AttendanceRecord"("status");
