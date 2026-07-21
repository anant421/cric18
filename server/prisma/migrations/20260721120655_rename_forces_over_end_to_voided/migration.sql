-- AlterTable
ALTER TABLE "Ball" DROP COLUMN "forcesOverEnd",
ADD COLUMN     "voidedFromOver" BOOLEAN NOT NULL DEFAULT false;
