-- 21_perf_indexes: High-performance compound & foreign key indexes
-- Additive only — optimizes tables: Order, OrderItem, Sale, SaleItem, BranchInventory, InventoryLog, Product, Notification, AuditLog

-- BranchInventory
CREATE INDEX IF NOT EXISTS "BranchInventory_stockQuantity_idx" ON "BranchInventory"("stockQuantity");
CREATE INDEX IF NOT EXISTS "BranchInventory_productId_idx" ON "BranchInventory"("productId");

-- Product
CREATE INDEX IF NOT EXISTS "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
CREATE INDEX IF NOT EXISTS "Product_groupSlug_idx" ON "Product"("groupSlug");
CREATE INDEX IF NOT EXISTS "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX IF NOT EXISTS "Product_isFeatured_idx" ON "Product"("isFeatured");

-- Order
CREATE INDEX IF NOT EXISTS "Order_orderStatus_createdAt_idx" ON "Order"("orderStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_branchId_createdAt_idx" ON "Order"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

-- OrderItem
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");

-- Sale
CREATE INDEX IF NOT EXISTS "Sale_branchId_createdAt_idx" ON "Sale"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_cashierId_createdAt_idx" ON "Sale"("cashierId", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX IF NOT EXISTS "Sale_shiftId_idx" ON "Sale"("shiftId");

-- SaleItem
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SaleItem_productId_idx" ON "SaleItem"("productId");

-- InventoryLog
CREATE INDEX IF NOT EXISTS "InventoryLog_branchId_productId_createdAt_idx" ON "InventoryLog"("branchId", "productId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryLog_referenceId_idx" ON "InventoryLog"("referenceId");
CREATE INDEX IF NOT EXISTS "InventoryLog_createdAt_idx" ON "InventoryLog"("createdAt");

-- Notification
CREATE INDEX IF NOT EXISTS "Notification_branchId_isRead_createdAt_idx" ON "Notification"("branchId", "isRead", "createdAt");

-- AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_entity_idx" ON "AuditLog"("createdAt", "entity");
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
