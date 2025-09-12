-- CreateIndex
CREATE INDEX "attendance_stream_date_composite" ON "AttendanceRecord"("streamId", "classDate", "userId");

-- CreateIndex
CREATE INDEX "override_stream_date_composite" ON "ClassOverride"("streamId", "classDate", "originalSubjectName");

-- CreateIndex
CREATE INDEX "timetable_stream_date_range" ON "Timetable"("streamId", "validFrom", "validUntil");
