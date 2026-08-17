require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Site = require('./models/Site');
const User = require('./models/User');
const Stock = require('./models/Stock'); 
const Activite = require('./models/Activite');

const genererMdpTemporaire = () => Math.random().toString(36).slice(-8);

const seedProduction = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔌 Connexion à MongoDB Atlas réussie.");

    // 1. Nettoyage TOTAL
    await Promise.all([
      Site.deleteMany({}),
      User.deleteMany({}),
      Stock.deleteMany({}),
      Activite.deleteMany({})
    ]);
    console.log("🧹 Base de données réinitialisée pour la production.");

    // 2. Création des 3 Agences
    const agences = await Site.insertMany([
      { nom: 'Agence Tabligbo', ville: 'Tabligbo' },
      { nom: 'Agence Adétikopé', ville: 'Adétikopé' },
      { nom: 'Agence Difakpota', ville: 'Difakpota' }
    ]);
    console.log("✅ Les 3 agences ont été créées avec leurs vrais IDs.");

    const idTabligbo = agences.find(a => a.ville === 'Tabligbo')._id;
    const idAdetikope = agences.find(a => a.ville === 'Adétikopé')._id;
    const idDifakpota = agences.find(a => a.ville === 'Difakpota')._id;

    // 3. Mots de passe
    const mdpDirecteur = 'Directeur2026!';
    const mdpSecTab1 = genererMdpTemporaire();
    const mdpSecTab2 = genererMdpTemporaire();
    const mdpSecTab3 = genererMdpTemporaire();
    const mdpSecTab4 = genererMdpTemporaire();
    const mdpSecAde  = genererMdpTemporaire();
    const mdpSecDif  = genererMdpTemporaire();

    // 4. Utilisateurs
    const usersData = [
      // --- DIRECTION GÉNÉRALE ---
      {
        email: 'tous.medannou@espacecommercial.com',
        password: await bcrypt.hash(mdpDirecteur, 10),
        username: 'Direction Générale',
        role: 'directeur',
        departement: 'direction',
        doit_changer_mdp: true,
        site_id: null 
      },

      // --- TABLIGBO ---
      {
        email: 'secretaire1.tabligbo@espacecommercial.com',
        password: await bcrypt.hash(mdpSecTab1, 10),
        username: 'Secrétariat 1 - Bâches & Grands Formats',
        role: 'secretaire',
        poste: 'secretaire_1',
        departement: 'grand_format',
        doit_changer_mdp: true,
        site_id: idTabligbo
      },
      {
        email: 'secretaire2.tabligbo@espacecommercial.com',
        password: await bcrypt.hash(mdpSecTab2, 10),
        username: 'Secrétariat 2 - Saisie & Impressions Papier',
        role: 'secretaire',
        poste: 'secretaire_2',
        departement: 'saisie_impression',
        doit_changer_mdp: true,
        site_id: idTabligbo
      },
      {
        email: 'secretaire3.tabligbo@espacecommercial.com',
        password: await bcrypt.hash(mdpSecTab3, 10),
        username: 'Secrétariat 3 - Boutique & Gestion Stock',
        role: 'secretaire',
        poste: 'secretaire_3',
        departement: 'boutique_stock',
        doit_changer_mdp: true,
        site_id: idTabligbo
      },
      {
        email: 'secretaire4.tabligbo@espacecommercial.com',
        password: await bcrypt.hash(mdpSecTab4, 10),
        username: 'Secrétariat 4 - Papier & Rames',
        role: 'secretaire',
        poste: 'secretaire_4',
        departement: 'papeterie',
        doit_changer_mdp: true,
        site_id: idTabligbo
      },

      // --- ADÉTIKOPÉ ---
      {
        email: 'secretaire1.adetikope@espacecommercial.com',
        password: await bcrypt.hash(mdpSecAde, 10),
        username: 'Secrétariat Adétikopé',
        role: 'secretaire',
        poste: 'polyvalent',
        departement: 'polyvalent',
        doit_changer_mdp: true,
        site_id: idAdetikope
      },

      // --- DIFAKPOTA ---
      {
        email: 'secretaire1.difakpota@espacecommercial.com',
        password: await bcrypt.hash(mdpSecDif, 10),
        username: 'Secrétariat Difakpota',
        role: 'secretaire',
        poste: 'polyvalent',
        departement: 'polyvalent',
        doit_changer_mdp: true,
        site_id: idDifakpota
      }
    ];

    await User.insertMany(usersData);
    
    console.log("\n=======================================================");
    console.log("🎉 INITIALISATION COMPLÈTE TERMINÉE AVEC SUCCÈS !");
    console.log("⚠️ CONSERVEZ SOIGNEUSEMENT CES IDENTIFIANTS ⚠️");
    console.log("=======================================================\n");
    
    console.log(`[DIRECTEUR GÉNÉRAL]`);
    console.log(`Email : tous.medannou@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpDirecteur}\n`);

    console.log(`[TABLIGBO - Secrétaire 1 : Bâches / Grands Formats]`);
    console.log(`Email : secretaire1.tabligbo@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpSecTab1}\n`);

    console.log(`[TABLIGBO - Secrétaire 2 : Impression Papier & Saisie]`);
    console.log(`Email : secretaire2.tabligbo@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpSecTab2}\n`);

    console.log(`[TABLIGBO - Secrétaire 3 : Stock & Ventes Boutique]`);
    console.log(`Email : secretaire3.tabligbo@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpSecTab3}\n`);

    console.log(`[TABLIGBO - Secrétaire 4 : Papier & Rames]`);
    console.log(`Email : secretaire4.tabligbo@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpSecTab4}\n`);

    console.log(`[ADÉTIKOPÉ - Secrétaire Polyvalente]`);
    console.log(`Email : secretaire1.adetikope@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpSecAde}\n`);

    console.log(`[DIFAKPOTA - Secrétaire Polyvalente]`);
    console.log(`Email : secretaire1.difakpota@espacecommercial.com`);
    console.log(`Mot de passe : ${mdpSecDif}\n`);

    console.log("=======================================================");
    
    process.exit();

  } catch (err) {
    console.error("❌ Erreur lors de l'initialisation :", err);
    process.exit(1);
  }
};

seedProduction();