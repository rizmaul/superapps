-- AlterTable
ALTER TABLE "spending_logs" ADD COLUMN "use_quota" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "monthly_quotas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_quotas_year_month_key" ON "monthly_quotas"("year", "month");
