-- AlterTable
ALTER TABLE "Ball" ADD COLUMN     "isOverthrow" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "umpire1" TEXT,
ADD COLUMN     "umpire2" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "gender" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "bestCatchBallId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_bestCatchBallId_key" ON "Tournament"("bestCatchBallId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_bestCatchBallId_fkey" FOREIGN KEY ("bestCatchBallId") REFERENCES "Ball"("id") ON DELETE SET NULL ON UPDATE CASCADE;
