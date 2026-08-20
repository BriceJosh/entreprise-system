const path = require("path");
const mongoose = require(
  path.join(__dirname, "../Backend/node_modules/mongoose"),
);

async function initReplicaSet() {
  const uri = "mongodb://127.0.0.1:27017/entreprise_db?directConnection=true";
  console.log("Connexion directe à MongoDB local...");

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅ Connecté au serveur MongoDB.");

    const admin = mongoose.connection.db.admin();

    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log("✅ Le Replica Set est déjà initialisé ! Nom :", status.set);
    } catch (err) {
      if (
        err.codeName === "NotYetInitialized" ||
        err.message.includes("no replset config has been received")
      ) {
        console.log("⚙️ Initialisation du Replica Set (rs0)...");
        await admin.command({
          replSetInitiate: {
            _id: "rs0",
            members: [{ _id: 0, host: "127.0.0.1:27017" }],
          },
        });
        console.log('✅ Replica Set "rs0" initialisé avec succès !');
      } else {
        console.error("Erreur statut Replica Set :", err.message);
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(
      "❌ Erreur de connexion ou d'initialisation MongoDB :",
      err.message,
    );
    process.exit(1);
  }
}

initReplicaSet();
