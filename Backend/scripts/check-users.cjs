require('dotenv').config();
const mongoose = require('mongoose');

// Import des Modèles (Ajustez les chemins si nécessaire)
const User = require('../models/User');
const Site = require('../models/Site');

async function inspecterUtilisateurs() {
  try {
    console.log("🔄 Connexion à MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté avec succès.\n");

    // Récupération des utilisateurs avec remplissage automatique des infos du site
    const utilisateurs = await User.find().populate('site_id', 'nom ville');

    if (utilisateurs.length === 0) {
      console.log("⚠️ Aucun utilisateur trouvé dans la base de données.");
    } else {
      // Formatage sous forme de tableau propre pour le terminal
      const tableauLisible = utilisateurs.map(u => ({
        ID: u._id.toString(),
        Username: u.username || 'N/A',
        Email: u.email || 'N/A',
        Rôle: u.role,
        Site: u.site_id ? `${u.site_id.nom} (${u.site_id.ville || 'SANS VILLE'})` : '❌ Aucun site'
      }));

      console.log("📋 --- LISTE DES UTILISATEURS ACTUELS ---");
      console.table(tableauLisible);
    }

  } catch (error) {
    console.error("❌ Erreur lors de l'inspection :", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Déconnexion de MongoDB.");
    process.exit(0);
  }
}

inspecterUtilisateurs();