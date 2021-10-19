-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "result_released_at" TIMESTAMP(3);

--Update exising entries
UPDATE "Challenge"
SET "result_released_at" = NOW()
WHERE "Challenge"."has_released_result";

