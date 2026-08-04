-- CreateTable
CREATE TABLE "TimeEntryAdjustmentLog" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "adjustedByEmail" TEXT NOT NULL,
    "reason" TEXT,
    "pairedLogId" TEXT,
    "beforeClockIn" TIMESTAMP(3),
    "afterClockIn" TIMESTAMP(3),
    "beforeClockOut" TIMESTAMP(3),
    "afterClockOut" TIMESTAMP(3),
    "beforeSiteId" TEXT,
    "afterSiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntryAdjustmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntryAdjustmentLog_timeEntryId_idx" ON "TimeEntryAdjustmentLog"("timeEntryId");

-- CreateIndex
CREATE INDEX "TimeEntryAdjustmentLog_createdAt_idx" ON "TimeEntryAdjustmentLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TimeEntryAdjustmentLog" ADD CONSTRAINT "TimeEntryAdjustmentLog_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
