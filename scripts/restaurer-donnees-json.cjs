const fs = require("fs");
const path = require("path");
const mongoose = require(
  path.join(__dirname, "../Backend/node_modules/mongoose"),
);
let EJSON;
try {
  EJSON = require(
    path.join(__dirname, "../Backend/node_modules/bson"),
  ).EJSON;
} catch {
  console.error("❌ Module 'bson' introuvable dans Backend/node_modules.");
  process.exit(1);
}

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
    // Conversion Extended JSON -> vrais types BSON
    // ($oid -> ObjectId, $date -> Date, $numberInt/$numberLong -> nombres...)
    let docs;
    try {
      const parsed = EJSON.parse(fs.readFileSync(filePath, "utf-8"), {
        relaxed: true,
      });
      docs = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error(`   ❌ JSON illisible (${f}) : ${e.message}`);
      continue;
    }

    if (!Array.isArray(docs) || docs.length === 0) continue;

    console.log(
      `\n⏳ Insertion dans [${collName}] (${docs.length} documents)...`,
    );
    const coll = conn.db.collection(collName);

    let inserted = 0;
    let echoues = 0;
    for (const doc of docs) {
      try {
        await coll.replaceOne({ _id: doc._id }, doc, { upsert: true });
        inserted++;
      } catch (err) {
        echoues++;
        if (echoues <= 3) {
          console.error(`   ⚠️ Document ignoré (${err.message})`);
        }
      }
    }
    console.log(
      `   ✅ [${collName}] : ${inserted}/${docs.length} insérés/mis à jour avec succès.`,
    );
    if (echoues > 0) {
      console.error(`   ❌ [${collName}] : ${echoues} document(s) en échec !`);
    }
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
