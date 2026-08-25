const path = require('path');
const backendPath = path.join(__dirname, '../Backend');

const mongoose = require(path.join(backendPath, 'node_modules/mongoose'));
const fs = require('fs');
require(path.join(backendPath, 'node_modules/dotenv')).config({ path: path.join(backendPath, '.env') });
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0";
const DATA_DIR = path.join(__dirname, '../data_recuperee_json');

async function importData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    // Vérifier si le dossier existe
    if (!fs.existsSync(DATA_DIR)) {
      console.error(`❌ Dossier non trouvé : ${DATA_DIR}`);
      return;
    }

    const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith('.js'));
    
    for (const file of files) {
      const collectionName = file.replace('.js', '');
      const filePath = path.join(DATA_DIR, file);
      
      console.log(`\n⏳ Traitement du fichier : ${file}`);
      const rawData = fs.readFileSync(filePath, 'utf8');
      
      try {
        const data = JSON.parse(rawData);
        if (Array.isArray(data) && data.length > 0) {
          // Utilisation d'une collection générique pour éviter les erreurs de modèle
          const collection = mongoose.connection.collection(collectionName);
          await collection.insertMany(data, { ordered: false });
          console.log(`🚀 ${data.length} documents insérés dans la collection '${collectionName}'`);
        } else {
          console.log(`ℹ️ Pas de données dans ${file}`);
        }
      } catch (err) {
        console.error(`❌ Erreur sur ${file}: ${err.message}`);
      }
    }
    console.log('\n🎉 Restauration terminée !');
  } catch (error) {
    console.error('❌ Erreur globale :', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

importData();

