-- AlterTable
ALTER TABLE "User" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "powerup_grief_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "powerup_protec_count" INTEGER NOT NULL DEFAULT 0;
