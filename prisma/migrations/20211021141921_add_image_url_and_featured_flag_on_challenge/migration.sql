-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false;
