import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDatabase from "../config/dbConnect.js";
import addVisibilityFields from "./scripts/20260223_add_visibility_fields.js";
import minifigCollectionIds from "./scripts/20260706_minifig_collection_ids.js";

if ((process.env.NODE_ENV || "").toLowerCase() !== "production") {
  dotenv.config({ path: "./config/config.env", quiet: true });
}

// Migration Registry (npm run migrate to run migration)

const migrations = [
  {
    name: "20260223_add_visibility_fields",
    run: addVisibilityFields,
  },
  {
    name: "20260706_minifig_collection_ids",
    run: minifigCollectionIds,
  },
];

// Migration Tracking Model

const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    executedAt: { type: Date, default: Date.now },
  },
  { collection: "_migrations" },
);

const Migration =
  mongoose.models._Migration || mongoose.model("_Migration", migrationSchema);

// Run Pending Migrations

async function runMigrations() {
  const executed = await Migration.find().lean();
  const executedNames = new Set(executed.map((m) => m.name));

  const pending = migrations.filter((m) => !executedNames.has(m.name));

  if (pending.length === 0) {
    console.log("\n✅ All migrations are up to date.\n");
    return;
  }

  console.log(`\n🔄 ${pending.length} pending migration(s):\n`);

  for (const m of pending) {
    console.log(`▶ Running: ${m.name} ...`);

    try {
      const result = await m.run();
      await Migration.create({ name: m.name });

      console.log("✅ Done", result ? `— ${JSON.stringify(result)}` : "");
    } catch (error) {
      console.error(`❌ Failed: ${m.name}`);
      console.error(error.message);
      process.exit(1);
    }
  }

  console.log("\n✅ All migrations complete.\n");
}

// Main

async function main() {
  await connectDatabase();
  await runMigrations();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
