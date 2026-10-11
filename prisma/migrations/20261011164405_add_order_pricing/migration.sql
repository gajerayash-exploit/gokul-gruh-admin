-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessDate" DATETIME NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "orderType" TEXT NOT NULL DEFAULT '',
    "docketNumber" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "admins" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("address", "businessDate", "createdAt", "createdById", "deletedAt", "docketNumber", "fullName", "id", "orderType", "phoneNumber", "status", "updatedAt", "updatedById", "version") SELECT "address", "businessDate", "createdAt", "createdById", "deletedAt", "docketNumber", "fullName", "id", "orderType", "phoneNumber", "status", "updatedAt", "updatedById", "version" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE INDEX "orders_businessDate_idx" ON "orders"("businessDate");
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");
CREATE INDEX "orders_docketNumber_idx" ON "orders"("docketNumber");
CREATE INDEX "orders_fullName_idx" ON "orders"("fullName");
CREATE INDEX "orders_phoneNumber_idx" ON "orders"("phoneNumber");
CREATE INDEX "orders_updatedAt_idx" ON "orders"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
