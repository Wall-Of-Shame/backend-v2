-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "applied_protec" TIMESTAMP(3),
ADD COLUMN     "griefed_by_userId" TEXT;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_griefed_by_userId_fkey" FOREIGN KEY ("griefed_by_userId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
