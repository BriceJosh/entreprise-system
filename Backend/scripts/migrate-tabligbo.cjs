require('dotenv').config();
const mongoose = require('mongoose');

// Import des Modèles (Ajustez les chemins si nécessaire)
const Site = require('../models/Site');
const User = require('../models/User');
const Stock = require('../models/Stock');

async function migrerSitesTabligbo() {
  try {
    console.log("🔄 Connexion à MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connecté à la base de données.");

    // =============================================================
    // 1. CRÉATION / MISE À JOUR DES 3 SITES DE TABLIGBO
    // =============================================================
    console.log("\n📍 Création / Vérification des sites...");

    const sitesConfig = [
      { nom: 'Tabligbo 1', ville: 'Tabligbo', description: 'Guichet 1 - Secrétaire 1' },
      { nom: 'Tabligbo 2', ville: 'Tabligbo', description: 'Guichet 2 - Secrétaire 2' },
      { nom: 'Tabligbo 3', ville: 'Tabligbo', description: 'Guichet 3 - Secrétaires 3 et 4' }
    ];

    const sitesCrees = {};

    for (const siteData of sitesConfig) {
      const site = await Site.findOneAndUpdate(
        { nom: siteData.nom },
        siteData,
        { new: true, upsert: true, runValidators: true }
      );
      sitesCrees[siteData.nom] = site._id;
      console.log(`   ✓ Site prêt : "${site.nom}" (ID: ${site._id})`);
    }

    // =============================================================
    // 2. RÉAFFECTATION PRÉCISE DES SECRÉTAIRES
    // =============================================================
    console.log("\n👤 Réaffectation des utilisateurs aux guichets...");

    const repartitionUtilisateurs = [
      {
        filtre: { email: 'secretaire1.tabligbo@espacecommercial.com' },
        nouveauSiteId: sitesCrees['Tabligbo 1'],
        label: 'Secrétaire 1 -> Tabligbo 1'
      },
      {
        filtre: { email: 'secretaire2.tabligbo@espacecommercial.com' },
        nouveauSiteId: sitesCrees['Tabligbo 2'],
        label: 'Secrétaire 2 -> Tabligbo 2'
      },
      {
        filtre: { 
          email: { 
            $in: [
              'secretaire3.tabligbo@espacecommercial.com', 
              'secretaire4.tabligbo@espacecommercial.com'
            ] 
          } 
        },
        nouveauSiteId: sitesCrees['Tabligbo 3'],
        label: 'Secrétaires 3 & 4 -> Tabligbo 3'
      }
    ];

    for (const regle of repartitionUtilisateurs) {
      const resultat = await User.updateMany(
        regle.filtre,
        { $set: { site_id: regle.nouveauSiteId } }
      );
      console.log(`   ✓ ${regle.label} : ${resultat.modifiedCount} utilisateur(s) mis à jour.`);
    }

    // =============================================================
    // 3. MIGRATION DU STOCK EXISTANT (Copie sur les 3 guichets)
    // =============================================================
    console.log("\n📦 Duplication/Attribution du stock existant...");

    const ancienSite = await Site.findOne({ nom: /^Tabligbo$/i });

    if (ancienSite) {
      const stocksExistants = await Stock.find({ site_id: ancienSite._id });
      console.log(`   ℹ️ ${stocksExistants.length} article(s) trouvé(s) sur l'ancien site "Tabligbo".`);

      for (const stock of stocksExistants) {
        for (const [nomSite, siteId] of Object.entries(sitesCrees)) {
          await Stock.findOneAndUpdate(
            { nom_article: stock.nom_article, site_id: siteId },
            {
              nom_article: stock.nom_article,
              quantite: stock.quantite,
              seuil_alerte: stock.seuil_alerte,
              multiplicateur_gros: stock.multiplicateur_gros,
              multiplicateur_detail: stock.multiplicateur_detail,
              prix_vente_unite: stock.prix_vente_unite,
              prix_vente_detail: stock.prix_vente_detail,
              prix_vente_gros: stock.prix_vente_gros,
              site_id: siteId
            },
            { upsert: true, new: true }
          );
        }
      }
      console.log("   ✓ Stock initial copié avec succès sur Tabligbo 1, 2 et 3.");
    } else {
      console.log("   ℹ️ Aucun site nommé uniquement \"Tabligbo\" n'a été trouvé à migrer.");
    }

    console.log("\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS !");
  } catch (error) {
    console.error("\n❌ ERREUR LORS DE LA MIGRATION :", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnexion de MongoDB.");
    process.exit(0);
  }
}

migrerSitesTabligbo();