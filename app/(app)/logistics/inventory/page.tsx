import InventoryPageClient from "./InventoryPageClient";
import { getInventoryItems } from "@/app/actions/inventory";
import { getSession } from "@/lib/auth";

export default async function InventoryPage() {
  const [session, itemsResult] = await Promise.all([
    getSession(),
    getInventoryItems(),
  ]);

  return (
    <InventoryPageClient
      initialSession={session}
      initialItems={
        "success" in itemsResult && itemsResult.items ? itemsResult.items : []
      }
    />
  );
}
