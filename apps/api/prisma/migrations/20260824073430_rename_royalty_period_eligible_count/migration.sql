/*
  Warnings:

  - You are about to drop the column `eligibleAtTierCount` on the `RoyaltyAllocation` table. All the data in the column will be lost.
  - Added the required column `periodEligibleCount` to the `RoyaltyAllocation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RoyaltyAllocation" DROP COLUMN "eligibleAtTierCount",
ADD COLUMN     "periodEligibleCount" INTEGER NOT NULL;
