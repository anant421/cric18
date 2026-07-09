-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "mobileNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_mobileNumber_key" ON "Player"("mobileNumber");
