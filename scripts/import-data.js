const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Backend/.env') });

// Import des modèles
const Activite = require('../Backend/models/Activite');
const Site = require('../Backend/models/Site');
const User = require('../Backend/models/User');

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/entreprise_db?replicaSet=rs0";
const DATA_DIR = path.join(__dirname, '../data_recuperee_json');

const models = {
  activites: Activite,
  sites: Site,
  users: User
};

async function importData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    for (const [key, Model] of Object.entries(models)) {
      const filePath = path.join(DATA_DIR, `${key}.js`); // Vos fichiers sont en .js mais contiennent du JSON
      
      if (fs.existsSync(filePath)) {
        console.log(`⏳ Lecture de ${filePath}...`);
        // On lit le fichier et on parse le contenu
        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);

        if (data.length > 0) {
          console.log(`🚀 Insertion de ${data.length} documents dans ${key}...`);
          
          // Utilisation de collection.insertMany pour ignorer les validations Mongoose
          // et forcer l'insertion des données brutes
          await Model.collection.insertMany(data, { ordered: false });
          console.log(`✅ ${key} importé avec succès.`);
        }
      } else {
        console.warn(`⚠️ Fichier non trouvé : ${filePath}`);
      }
    }

    console.log('🎉 Restauration terminée !');
  } catch (error) {
    console.error('❌ Erreur lors de l\'importation :', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

importData();
