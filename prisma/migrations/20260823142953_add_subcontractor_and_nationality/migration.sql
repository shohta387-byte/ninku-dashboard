-- CreateEnum
CREATE TYPE "Nationality" AS ENUM ('JAPANESE', 'FOREIGN');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "isSubcontractor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nationality" "Nationality";

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "nationality" "Nationality";
