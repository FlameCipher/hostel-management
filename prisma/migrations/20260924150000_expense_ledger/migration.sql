CREATE TYPE "ExpenseCategory" AS ENUM ('CARETAKER','ELECTRICITY','WATER','REPAIRS_MAINTENANCE','SECURITY','CLEANING','INTERNET','TAXES_LICENSES','SUPPLIES','OTHER');
CREATE TABLE "Expense" ("id" TEXT NOT NULL,"organizationId" TEXT NOT NULL,"recordedById" TEXT,"category" "ExpenseCategory" NOT NULL,"description" TEXT NOT NULL,"amount" DECIMAL(12,2) NOT NULL,"expenseDate" TIMESTAMP(3) NOT NULL,"payee" TEXT,"reference" TEXT,"notes" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Expense_organizationId_expenseDate_idx" ON "Expense"("organizationId","expenseDate");
CREATE INDEX "Expense_organizationId_category_idx" ON "Expense"("organizationId","category");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
