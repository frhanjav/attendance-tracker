/*
  Warnings:

  - A unique constraint covering the columns `[streamId,classDate,originalSubjectName]` on the table `ClassOverride` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ClassOverride_streamId_classDate_originalSubjectName_origin_key";

-- CreateIndex
CREATE UNIQUE INDEX "ClassOverride_streamId_classDate_originalSubjectName_key" ON "ClassOverride"("streamId", "classDate", "originalSubjectName");
