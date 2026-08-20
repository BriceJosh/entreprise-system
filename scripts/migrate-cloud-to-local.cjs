const path = require("path");
const mongoose = require(
  path.join(__dirname, "../Backend/node_modules/mongoose"),
);

// URL Cloud Atlas (source)
const CLOUD_URI =
  process.env.CLOUD_MONGO_URI ||
  "mongodb+srv://brice_admin:Joshua13@cluster0.wlbzdn0.mongodb.net/?appName=Cluster0";

// URL Locale (destination)
const LOCAL_URI =
  process.env.LOCAL_MONGO_URI ||
  "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0&directConnection=true";

async function migrateData() {
  console.log("==================================================");
  console.log("📦 MIGRATION DES DONNÉES CLOUD ATLAS ➔ LOCAL MONGODB");
  console.log("==================================================");

  console.log("\n1. Connexion à MongoDB Atlas (Source)...");
  const cloudConn = await mongoose.createConnection(CLOUD_URI).asPromise();
  console.log("✅ Connecté à MongoDB Atlas.");

  console.log("\n2. Connexion à MongoDB Local (Destination)...");
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log("✅ Connecté à MongoDB Local.");

  const collections = await cloudConn.db.listCollections().toArray();
  console.log(
    `\n📋 ${collections.length} collection(s) trouvée(s) sur Atlas.\n`,
  );

  for (const collInfo of collections) {
    const collName = collInfo.name;
    if (collName.startsWith("system.")) continue;

    console.log(`⏳ Migration de la collection [${collName}]...`);
    const sourceColl = cloudConn.db.collection(collName);
    const destColl = localConn.db.collection(collName);

    const docs = await sourceColl.find({}).toArray();
    console.log(`   ➔ ${docs.length} document(s) à transférer.`);

    if (docs.length > 0) {
      // Nettoyer la collection locale si déjà existante pour éviter les doublons d'_id
      await destColl.deleteMany({});
      await destColl.insertMany(docs);
      console.log(
        `   ✅ Collection [${collName}] migrée avec succès (${docs.length} docs).`,
      );
    } else {
      console.log(`   ⚪ Collection [${collName}] est vide, passée.`);
    }
  }

  console.log("\n==================================================");
  console.log("🎉 TOUTES LES DONNÉES ONT ÉTÉ MIGRÉES AVEC SUCCÈS !");
  console.log("==================================================");

  await cloudConn.close();
  await localConn.close();
  process.exit(0);
}

migrateData().catch((err) => {
  console.error("\n❌ Erreur pendant la migration :", err);
  process.exit(1);
});
