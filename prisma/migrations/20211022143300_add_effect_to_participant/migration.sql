-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "effect_egg" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "effect_poop" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "effect_tomato" BIGINT NOT NULL DEFAULT 0;
