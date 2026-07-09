-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "manOfMatchId" TEXT,
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'LEAGUE';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "photoUrl" TEXT;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_manOfMatchId_fkey" FOREIGN KEY ("manOfMatchId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
