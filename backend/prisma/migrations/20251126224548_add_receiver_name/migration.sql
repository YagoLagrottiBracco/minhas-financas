-- DropForeignKey
ALTER TABLE "Bill" DROP CONSTRAINT "Bill_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringBill" DROP CONSTRAINT "RecurringBill_receiverId_fkey";

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "receiverName" TEXT,
ALTER COLUMN "receiverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RecurringBill" ADD COLUMN     "receiverName" TEXT,
ALTER COLUMN "receiverId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringBill" ADD CONSTRAINT "RecurringBill_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
