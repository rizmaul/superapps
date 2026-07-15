-- CreateTable
CREATE TABLE "spending_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "spent_at" DATETIME NOT NULL,
    "receipt_image_url" TEXT,
    "notes" TEXT
);
