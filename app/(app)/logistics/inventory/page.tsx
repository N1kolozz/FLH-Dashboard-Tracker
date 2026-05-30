import InventoryPageClient from "./InventoryPageClient";
import { getInventoryItems } from "@/app/actions/inventory";
import { getSession } from "@/lib/auth";

export default async function InventoryPage() {
  const [session, itemsResult] = await Promise.all([
    getSession(),
    getInventoryItems(),
  ]);

  const hasItems = "success" in itemsResult && itemsResult.items;

  return (
    <InventoryPageClient
      initialSession={session}
      initialItems={hasItems ? itemsResult.items : []}
      initialTotal={hasItems ? itemsResult.total ?? 0 : 0}
      initialPageSize={hasItems ? itemsResult.pageSize ?? 15 : 15}
    />
  );
}
