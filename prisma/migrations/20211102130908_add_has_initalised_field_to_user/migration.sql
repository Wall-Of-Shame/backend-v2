-- AlterTable
ALTER TABLE "User" ADD COLUMN     "has_initialised" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
  SET "has_initialised" = true
  WHERE "username" NOT SIMILAR TO 'User#[0-9]{6}';