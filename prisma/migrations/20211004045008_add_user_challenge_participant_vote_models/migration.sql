-- CreateEnum
CREATE TYPE "AvatarAnimal" AS ENUM ('CAT', 'DOG', 'RABBIT');

-- CreateEnum
CREATE TYPE "AvatarColor" AS ENUM ('PRIMARY', 'SECONDARY', 'TERTIARY');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('LAST_TO_COMPLETE', 'NOT_COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fb_reg_token" TEXT,
    "fb_reg_token_time" TIMESTAMP(3),
    "username" TEXT,
    "name" TEXT,
    "cfg_deadline_reminder" BOOLEAN NOT NULL DEFAULT true,
    "cfg_invites_notif" BOOLEAN NOT NULL DEFAULT true,
    "avatar_animal" "AvatarAnimal",
    "avatar_color" "AvatarColor",
    "avatar_bg" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "challengeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3) NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "has_released_result" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("challengeId")
);

-- CreateTable
CREATE TABLE "Participant" (
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "evidence_link" TEXT,
    "has_been_vetoed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("challengeId","userId")
);

-- CreateTable
CREATE TABLE "Contact" (
    "pers1_id" TEXT NOT NULL,
    "pers2_id" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("pers1_id","pers2_id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "challengeId" TEXT NOT NULL,
    "victimId" TEXT NOT NULL,
    "accuserId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_challengeId_victimId_accuserId_key" ON "Vote"("challengeId", "victimId", "accuserId");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("challengeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_pers1_id_fkey" FOREIGN KEY ("pers1_id") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_pers2_id_fkey" FOREIGN KEY ("pers2_id") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("challengeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_victimId_fkey" FOREIGN KEY ("victimId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_accuserId_fkey" FOREIGN KEY ("accuserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_challengeId_victimId_fkey" FOREIGN KEY ("challengeId", "victimId") REFERENCES "Participant"("challengeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_challengeId_accuserId_fkey" FOREIGN KEY ("challengeId", "accuserId") REFERENCES "Participant"("challengeId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
