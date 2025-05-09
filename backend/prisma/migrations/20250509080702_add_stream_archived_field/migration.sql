-- AlterTable
ALTER TABLE "Stream" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Stream_isArchived_idx" ON "Stream"("isArchived");
