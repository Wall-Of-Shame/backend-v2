/*
  Warnings:

  - Added the required column `invite_type` to the `Challenge` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChallengeInviteType" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "invite_type" "ChallengeInviteType";

-- Set default value
UPDATE "Challenge"
SET "invite_type" = 'PRIVATE';

-- Enforce the not null constraint on invite_type
ALTER TABLE "Challenge" ALTER COLUMN     "invite_type" SET NOT NULL;
