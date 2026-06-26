-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "canvasX" REAL,
    "canvasY" REAL,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "recurFreq" TEXT,
    "recurInterval" INTEGER NOT NULL DEFAULT 1,
    "recurDays" TEXT,
    "recurUntil" DATETIME,
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "Column" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("boardId", "canvasX", "canvasY", "color", "columnId", "createdAt", "createdById", "description", "dueDate", "id", "isPersonal", "order", "priority", "startDate", "title", "updatedAt") SELECT "boardId", "canvasX", "canvasY", "color", "columnId", "createdAt", "createdById", "description", "dueDate", "id", "isPersonal", "order", "priority", "startDate", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
