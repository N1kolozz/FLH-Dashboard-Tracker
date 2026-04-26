export type RowWithOwnerUserIds = {
  owner_user_ids: unknown;
};

// Owner IDs can come from form data, legacy records, or Postgres arrays.
// Keep the sanitizing and de-duplication rules in one place.
export function normalizeOwnerUserIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ownerIds = new Set<number>();

  for (const id of value) {
    const numericId = Number(id);
    if (Number.isInteger(numericId)) {
      ownerIds.add(numericId);
    }
  }

  return Array.from(ownerIds);
}

// Builds fast lookup maps for summary and workload screens that group records by owner.
export function indexRowsByOwner<T extends RowWithOwnerUserIds>(rows: T[]) {
  const rowsByOwner = new Map<number, T[]>();

  for (const row of rows) {
    for (const ownerId of normalizeOwnerUserIds(row.owner_user_ids)) {
      const ownerRows = rowsByOwner.get(ownerId);
      if (ownerRows) {
        ownerRows.push(row);
      } else {
        rowsByOwner.set(ownerId, [row]);
      }
    }
  }

  return rowsByOwner;
}
