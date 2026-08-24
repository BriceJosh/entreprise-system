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
    const { type, designation, quantite, option_vente } = req.body;
    const site_id = req.user?.site_id || req.body.site_id;
    const user_id = req.user?._id || req.user?.id || req.user?.userId;

    if (!type || !designation || !quantite) {
      return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
    }

    let stockMisAJour = null;

    /*
      * =========================================================
      * PRIX RÉCUPÉRÉ AUTOMATIQUEMENT DEPUIS LE STOCK
      * =========================================================
      *
      * La secrétaire ne saisit plus le prix de vente.
      * L'application le récupère dans le stock selon le
      * mode de vente (Gros / Détail / Pièce).
      */

    let prix_unitaire = 0;
    let montant_total = 0;

    // --- DÉCRÉMENTATION DU STOCK PARTAGÉ (Pour les Ventes) ---
    if (type === 'vente') {
      /*
        * Le prix est OBLIGATOIREMENT récupéré depuis le stock.
        * Si l'article n'existe pas en stock, la vente est refusée.
        */

      const escapeRegexPrix = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const stockPourPrix = await Stock.findOne({
        site_id: site_id,
        nom_article: { $regex: new RegExp(`^${escapeRegexPrix(designation.trim())}$`, 'i') }
      });

      if (!stockPourPrix) {
        return res.status(400).json({
          message: `Article "${designation}" introuvable dans le stock. La vente est impossible.`
        });
      }

      prix_unitaire = stockPourPrix.obtenirPrixParOption(option_vente || 'Pièce');

      if (!prix_unitaire || prix_unitaire <= 0) {
        return res.status(400).json({
          message: `Aucun prix de vente configuré pour "${designation}" en mode ${option_vente || 'Pièce'}.`
        });
      }

      montant_total = Number(quantite) * prix_unitaire;

      /*
        * DÉCRÉMENTATION DU STOCK PARTAGÉ
        * (Partagé entre Secrétaire 3 et 4)
        */

      let multiplicateur = 1;
      if (option_vente === 'Détail') {
        multiplicateur = stockPourPrix.multiplicateur_detail || 1;
      } else if (option_vente === 'Gros') {
        multiplicateur = stockPourPrix.multiplicateur_gros || 1;
      }

      const qteAEnlever = Number(quantite) * multiplicateur;

      if (stockPourPrix.quantite < qteAEnlever) {
        return res.status(400).json({
          message: `Stock insuffisant pour "${designation}". Quantité restante : ${stockPourPrix.quantite} unité(s).`
        });
      }

      stockPourPrix.quantite -= qteAEnlever;
      stockMisAJour = await stockPourPrix.save();

      if (req.io) {
        req.io.emit('stock_mis_a_jour', stockMisAJour);
      }
    } else {
      /*
        * Pour les autres types d'opérations (impression, etc.),
        * le prix reste saisi manuellement.
        */

      const prixManuel = Number(req.body.prix_unitaire);

      if (!Number.isFinite(prixManuel) || prixManuel < 0) {
        return res.status(400).json({ message: "Veuillez saisir un prix unitaire valide." });
      }

      prix_unitaire = prixManuel;
      montant_total = Number(quantite) * prixManuel;
    }

    // --- ENREGISTREMENT DE L'ACTIVITÉ (Liée à la secrétaire connectée) ---
    const nouvelleActivite = new Activite({
      type,
      designation,
      quantite: Number(quantite),
      prix_unitaire: Number(prix_unitaire),
      montant_total: montant_total,
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