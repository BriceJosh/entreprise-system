const Activite = require('../models/Activite');
const Stock = require('../models/Stock');
const Depense = require('../models/Depense');

// ==========================================
// 1. RÉCUPÉRER LES ACTIVITÉS (Isolation de Caisse)
// ==========================================
exports.getActivites = async (req, res) => {
  try {
    const currentSiteId = req.query.site_id || req.user?.site_id;
    const currentUserId = req.user?._id || req.user?.id || req.user?.userId;

    let filtre = {};

    if (currentSiteId) {
      filtre.site_id = currentSiteId;
    }

    // ISOLATION DE LA CAISSE : Une secrétaire ne voit QUE ses propres opérations
    if (req.user?.role === 'secretaire') {
      filtre.user_id = currentUserId;
    }

const activites = await Activite.find(filtre)
  .sort({ createdAt: -1 })
  .populate('user_id', 'username email poste')
  .populate('site_id', 'nom');
  
    res.status(200).json(activites);
  } catch (error) {
    console.error("Erreur lors de la récupération des activités :", error);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des activités." });
  }
};

// ==========================================
// 2. CRÉER UNE ACTIVITÉ (Vente / Impression)
// ==========================================
exports.creerActivite = async (req, res) => {
  try {
    const { type, designation, quantite, prix_unitaire, option_vente, montant_total } = req.body;
    const site_id = req.user?.site_id || req.body.site_id;
    const user_id = req.user?._id || req.user?.id || req.user?.userId;

    if (!type || !designation || !quantite || prix_unitaire === undefined) {
      return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
    }

    let stockMisAJour = null;

    // --- DÉCRÉMENTATION DU STOCK PARTAGÉ (Pour les Ventes) ---
    if (type === 'vente') {
      const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Recherche de l'article dans le stock du site (Partagé entre Secrétaire 3 et 4)
      const stockItem = await Stock.findOne({
        site_id: site_id,
        nom_article: { $regex: new RegExp(`^${escapeRegex(designation.trim())}$`, 'i') }
      });

      if (stockItem) {
        let multiplicateur = 1;
        if (option_vente === 'Détail') {
          multiplicateur = stockItem.multiplicateur_detail || 1;
        } else if (option_vente === 'Gros') {
          multiplicateur = stockItem.multiplicateur_gros || 1;
        }

        const qteAEnlever = Number(quantite) * multiplicateur;

        if (stockItem.quantite < qteAEnlever) {
          return res.status(400).json({
            message: `Stock insuffisant pour "${designation}". Quantité restante : ${stockItem.quantite} unité(s).`
          });
        }

        stockItem.quantite -= qteAEnlever;
        stockMisAJour = await stockItem.save();

        if (req.io) {
          req.io.emit('stock_mis_a_jour', stockMisAJour);
        }
      }
    }

    // --- ENREGISTREMENT DE L'ACTIVITÉ (Liée à la secrétaire connectée) ---
    const nouvelleActivite = new Activite({
      type,
      designation,
      quantite: Number(quantite),
      prix_unitaire: Number(prix_unitaire),
      montant_total: montant_total || (Number(quantite) * Number(prix_unitaire)),
      option_vente: type === 'vente' ? (option_vente || 'Pièce') : undefined,
      site_id,
      user_id
    });

    let activiteSauvegardee = await nouvelleActivite.save();
    activiteSauvegardee = await activiteSauvegardee.populate('user_id', 'username email poste');

    if (req.io) {
      req.io.emit('activite_ajoutee', activiteSauvegardee);
    }

    res.status(201).json(activiteSauvegardee);
  } catch (error) {
    console.error("Erreur lors de la création de l'activité :", error);
    res.status(500).json({ message: "Erreur serveur lors de l'enregistrement de l'activité.", error: error.message });
  }
};

// ==========================================
// 3. ENREGISTRER UNE DÉPENSE (CORRIGÉ)
// ==========================================
exports.creerDepense = async (req, res) => {
  try {
    const { motif, montant } = req.body;
    const site_id = req.user?.site_id || req.body.site_id;
    const user_id = req.user?._id || req.user?.id || req.user?.userId;

    if (!motif || !montant) {
      return res.status(400).json({ message: "Le motif et le montant de la dépense sont requis." });
    }

    // CORRECTION 1 : Utilisation du modèle 'Depense' avec ses vrais champs (motif, montant)
    const nouvelleDepense = new Depense({
      motif: motif,
      montant: Number(montant),
      site_id: site_id,
      user_id: user_id
    });

    let depenseSauvegardee = await nouvelleDepense.save();
    depenseSauvegardee = await depenseSauvegardee.populate('user_id', 'username email poste');

    if (req.io) {
      // CORRECTION 2 : Emission du bon événement Socket.io
      req.io.emit('depense_ajoutee', depenseSauvegardee);
    }

    res.status(201).json(depenseSauvegardee);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la dépense :", error);
    res.status(500).json({ message: "Erreur serveur lors de la création de la dépense.", error: error.message });
  }
};