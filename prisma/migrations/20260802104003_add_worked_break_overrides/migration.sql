-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "clockIn" DATETIME,
    "clockOut" DATETIME,
    "originalClockIn" DATETIME,
    "originalClockOut" DATETIME,
    "isManuallyAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "adjustmentNote" TEXT,
    "adjustedAt" DATETIME,
    "adjustedByName" TEXT,
    "workedBreak1" BOOLEAN NOT NULL DEFAULT false,
    "workedBreak2" BOOLEAN NOT NULL DEFAULT false,
    "workedBreak3" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeEntry" ("adjustedAt", "adjustedByName", "adjustmentNote", "clockIn", "clockOut", "createdAt", "employeeId", "id", "isManuallyAdjusted", "originalClockIn", "originalClockOut", "siteId", "updatedAt", "workDate") SELECT "adjustedAt", "adjustedByName", "adjustmentNote", "clockIn", "clockOut", "createdAt", "employeeId", "id", "isManuallyAdjusted", "originalClockIn", "originalClockOut", "siteId", "updatedAt", "workDate" FROM "TimeEntry";
DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";
CREATE INDEX "TimeEntry_employeeId_workDate_idx" ON "TimeEntry"("employeeId", "workDate");
CREATE INDEX "TimeEntry_siteId_workDate_idx" ON "TimeEntry"("siteId", "workDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
