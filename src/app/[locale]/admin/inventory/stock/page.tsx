import { redirect } from 'next/navigation';

/**
 * `/admin/inventory/stock` used to be a second page that rendered the same
 * branch balances as `/admin/inventory`, built by aggregating every inventory
 * row in JavaScript. The canonical balances page now reads the same numbers
 * through the branch-scoped `getInventoryOverview` query, so this path is kept
 * only as an alias that forwards instead of 404ing for old bookmarks and links.
 */
export default function InventoryStockAliasPage() {
  redirect('/admin/inventory');
}
