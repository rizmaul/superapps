-- CreateTable: money_log_snapshots (one per timestamp entry session)
CREATE TABLE "money_log_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logged_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT
);

-- CreateTable: money_log_entries (individual account amounts per snapshot)
CREATE TABLE "money_log_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshot_id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "money_log_entries_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "money_log_snapshots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index for efficient snapshot lookups
CREATE INDEX "money_log_entries_snapshot_id_idx" ON "money_log_entries"("snapshot_id");
