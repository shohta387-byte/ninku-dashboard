-- DropForeignKey
ALTER TABLE "TimeEntryAdjustmentLog" DROP CONSTRAINT "TimeEntryAdjustmentLog_timeEntryId_fkey";

-- AddForeignKey
ALTER TABLE "TimeEntryAdjustmentLog" ADD CONSTRAINT "TimeEntryAdjustmentLog_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
