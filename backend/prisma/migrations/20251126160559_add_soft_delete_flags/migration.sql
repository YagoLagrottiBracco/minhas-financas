-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
