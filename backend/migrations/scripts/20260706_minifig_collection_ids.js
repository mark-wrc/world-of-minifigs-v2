import mongoose from "mongoose";

// Converts the legacy single `collectionId` on general inventory items into the
// new `collectionIds` array. Spider-Man previously belonging to one collection
// now belongs to a one-element array; admins can add more via the form.
export default async function minifigCollectionIds() {
  const inventory = mongoose.connection.db.collection("generalinventories");

  // Docs that still have the old scalar field: move it into an array.
  const withCollection = await inventory.updateMany(
    { collectionId: { $exists: true, $ne: null }, collectionIds: { $exists: false } },
    [
      { $set: { collectionIds: ["$collectionId"] } },
      { $unset: "collectionId" },
    ],
  );

  // Docs whose old field was null (or missing) get an empty array + cleanup.
  const withoutCollection = await inventory.updateMany(
    { collectionIds: { $exists: false } },
    { $set: { collectionIds: [] }, $unset: { collectionId: "" } },
  );

  return {
    migratedFromScalar: withCollection.modifiedCount,
    defaultedToEmpty: withoutCollection.modifiedCount,
  };
}
