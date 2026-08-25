const fs = require("fs");
const path = require("path");
const mongoose = require(
  path.join(__dirname, "../Backend/node_modules/mongoose"),
);

const INPUT_DIR = path.join(__dirname, "../data_recuperee_json");
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true";

async function restaurer() {
  console.log("==========================================================");
  console.log(" 📥 RESTAURATION DES DONNÉES RÉCUPÉRÉES DANS MONGODB      ");
  console.log("==========================================================");

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(
      `❌ Dossier ${INPUT_DIR} introuvable. Lancez d'abord l'extraction.`,
    );
    process.exit(1);
  }

  console.log(`\n1. Connexion à MongoDB (${MONGO_URI})...`);
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  console.log("✅ Connecté à MongoDB.");

  const jsonFiles = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".json"));

  for (const f of jsonFiles) {
    const collName = path.basename(f, ".json");
    const filePath = path.join(INPUT_DIR, f);
    const docs = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    if (!Array.isArray(docs) || docs.length === 0) continue;

    console.log(
      `\n⏳ Insertion dans [${collName}] (${docs.length} documents)...`,
    );
    const coll = conn.db.collection(collName);

    let inserted = 0;
    for (const doc of docs) {
      try {
        // Convertir les _id string ou structure ObjectId si besoin
        if (doc._id && typeof doc._id === "object" && doc._id.$oid) {
          doc._id = new mongoose.Types.ObjectId(doc._id.$oid);
        } else if (
          typeof doc._id === "string" &&
          /^[0-9a-fA-F]{24}$/.test(doc._id)
        ) {
          doc._id = new mongoose.Types.ObjectId(doc._id);
        }

        // Convertir les dates
        for (const [k, v] of Object.entries(doc)) {
          if (v && typeof v === "object" && v.$date) {
            doc[k] = new Date(v.$date);
          } else if (
            typeof v === "string" &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)
          ) {
            doc[k] = new Date(v);
          }
        }

        await coll.replaceOne({ _id: doc._id }, doc, { upsert: true });
        inserted++;
      } catch (err) {
        // Ignorer les erreurs ponctuelles de format
      }
    }
    console.log(
      `   ✅ [${collName}] : ${inserted}/${docs.length} insérés/mis à jour avec succès.`,
    );
  }

  console.log("\n==========================================================");
  console.log("🎉 RESTAURATION TERMINÉE AVEC SUCCÈS !");
  console.log("==========================================================");

  await conn.close();
  process.exit(0);
}

restaurer().catch((err) => {
  console.error("❌ Erreur de restauration :", err);
  process.exit(1);
});
