-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('OCCURRED', 'CANCELLED', 'REPLACED', 'PENDING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streamCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "timetableId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "subjectName" TEXT NOT NULL,
    "courseCode" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "courseCode" TEXT,
    "classDate" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "markedAt" TIMESTAMP(3) NOT NULL,
    "markedByUserId" TEXT,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkAttendanceEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "courseCode" TEXT,
    "attendedClasses" INTEGER NOT NULL,
    "totalClasses" INTEGER NOT NULL,
    "calculationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkAttendanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_streamCode_key" ON "Stream"("streamCode");

-- CreateIndex
CREATE INDEX "Stream_ownerId_idx" ON "Stream"("ownerId");

-- CreateIndex
CREATE INDEX "StreamMembership_userId_idx" ON "StreamMembership"("userId");

-- CreateIndex
CREATE INDEX "StreamMembership_streamId_idx" ON "StreamMembership"("streamId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamMembership_userId_streamId_key" ON "StreamMembership"("userId", "streamId");

-- CreateIndex
CREATE INDEX "Timetable_streamId_idx" ON "Timetable"("streamId");

-- CreateIndex
CREATE INDEX "Timetable_validFrom_idx" ON "Timetable"("validFrom");

-- CreateIndex
CREATE INDEX "TimetableEntry_timetableId_idx" ON "TimetableEntry"("timetableId");

-- CreateIndex
CREATE INDEX "TimetableEntry_dayOfWeek_idx" ON "TimetableEntry"("dayOfWeek");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_streamId_idx" ON "AttendanceRecord"("streamId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_classDate_idx" ON "AttendanceRecord"("classDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_streamId_subjectName_classDate_key" ON "AttendanceRecord"("userId", "streamId", "subjectName", "classDate");

-- CreateIndex
CREATE INDEX "BulkAttendanceEntry_userId_idx" ON "BulkAttendanceEntry"("userId");

-- CreateIndex
CREATE INDEX "BulkAttendanceEntry_streamId_idx" ON "BulkAttendanceEntry"("streamId");

-- CreateIndex
CREATE INDEX "BulkAttendanceEntry_subjectName_idx" ON "BulkAttendanceEntry"("subjectName");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamMembership" ADD CONSTRAINT "StreamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamMembership" ADD CONSTRAINT "StreamMembership_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "Timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkAttendanceEntry" ADD CONSTRAINT "BulkAttendanceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkAttendanceEntry" ADD CONSTRAINT "BulkAttendanceEntry_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
