/*
  Warnings:

  - You are about to drop the column `has_released_result` on the `Challenge` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "has_released_result" CASCADE;
