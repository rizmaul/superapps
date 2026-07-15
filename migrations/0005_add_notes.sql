-- CreateTable: notes
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "project_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Index for project filtering
CREATE INDEX "notes_project_id_idx" ON "notes"("project_id");
