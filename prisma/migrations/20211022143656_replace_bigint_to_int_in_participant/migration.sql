/*
  Warnings:

  - You are about to alter the column `effect_egg` on the `Participant` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `effect_poop` on the `Participant` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `effect_tomato` on the `Participant` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Participant" ALTER COLUMN "effect_egg" SET DEFAULT 0,
ALTER COLUMN "effect_egg" SET DATA TYPE INTEGER,
ALTER COLUMN "effect_poop" SET DEFAULT 0,
ALTER COLUMN "effect_poop" SET DATA TYPE INTEGER,
ALTER COLUMN "effect_tomato" SET DEFAULT 0,
ALTER COLUMN "effect_tomato" SET DATA TYPE INTEGER;
