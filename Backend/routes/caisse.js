const express = require('express');
const router = express.Router();
const Activite = require('../models/Activite');
const DepotBanque = require('../models/DepotBanque');
const Credit = require('../models/Credit');

const { verifyToken } = require('../middleware/authMiddleware');
const { estDirecteur, peutVoirCaissePropre } = require('../middleware/permissions');

function getUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id;
}

function getSiteId(req) {
  return req.user?.site_id || req.user?.site?._id || req.user?.site?.id;
}

function dateRange(date) {
  const target = date ? new Date(`${date}T00:00:00`) : new Date();
  if (Number.isNaN(target.getTime())) return null;

  const start = new Date(target);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// Direction : supervision globale.
router.get('/supervision', verifyToken, async (req, res) => {
  try {
    if (!estDirecteur(req)) {
      return res.status(403).json({
        message: 'Accès réservé à la direction.'
      });
    }

    const range = dateRange(req.query.date);
    if (!range) {
      return res.status(400).json({ message: 'Date invalide.' });
    }

    const filtre = {
      type: { $in: ['vente', 'impression', 'depense'] },
      createdAt: { $gte: range.start, $lte: range.end }
    };

    if (
      req.query.site_id &&
      req.query.site_id !== 'TOUS' &&
      req.query.site_id !== 'tous' &&
      req.query.site_id !== 'null' &&
      req.query.site_id !== 'undefined'
    ) {
      filtre.site_id = req.query.site_id;
    }

    const userDemande = req.query.user_id || req.query.secretaire_id;
    if (
      userDemande &&
      userDemande !== 'TOUS' &&
      userDemande !== 'tous' &&
      userDemande !== 'null' &&
      userDemande !== 'undefined'
    ) {
      filtre.user_id = userDemande;
    }

    const [activitesBrutes, depots, credits] = await Promise.all([
      Activite.find(filtre)
      .populate('user_id', 'username email role poste nom')
      .populate('site_id', 'nom ville')
      .sort({ createdAt: -1 })
      .lean(),
      DepotBanque.find({
        ...(filtre.site_id ? { site_id: filtre.site_id } : {}),
        ...(filtre.user_id ? { user_id: filtre.user_id } : {}),
        date_depot: { $gte: range.start, $lte: range.end }
      })
        .populate('user_id', 'username email role poste nom')
        .populate('site_id', 'nom ville')
        .lean(),
      Credit.find({
        ...(filtre.site_id ? { site_id: filtre.site_id } : {}),
        ...(filtre.user_id ? { user_id: filtre.user_id } : {}),
        $or: [
          { date_achat: { $gte: range.start, $lte: range.end } },
          { 'paiements.date_paiement': { $gte: range.start, $lte: range.end } }
        ]
      })
        .populate('user_id', 'username email role poste nom')
        .populate('site_id', 'nom ville')
        .populate('paiements.user_id', 'username email role poste nom')
        .lean()
    ]);

    const activites = [...activitesBrutes];

    let totalVentes = 0;
    let totalServices = 0;
    let totalDepenses = 0;
    let totalDepots = 0;
    let totalCredits = 0;
    let totalPaiementsCredits = 0;

    for (const activite of activites) {
      const montant = Number(
        activite.montant_total ??
        activite.montant ??
        ((activite.quantite || 0) * (activite.prix_unitaire || 0))
      ) || 0;

      if (activite.type === 'vente') totalVentes += montant;
      if (activite.type === 'impression') totalServices += montant;
      if (activite.type === 'depense') totalDepenses += montant;
    }

    depots.forEach((depot) => {
      const montant = Number(depot.montant) || 0;
      totalDepots += montant;
      activites.push({
        _id: `depot:${depot._id}`,
        type: 'depot',
        createdAt: depot.date_depot || depot.createdAt,
        user_id: depot.user_id,
        site_id: depot.site_id,
        designation: `Dépôt à ${depot.banque || 'la banque'}`,
        description: depot.note || depot.reference || '',
        quantite: null,
        prix_unitaire: null,
        montant_total: montant
      });
    });

    credits.forEach((credit) => {
      const dateAchat = new Date(credit.date_achat || credit.createdAt);
      if (dateAchat >= range.start && dateAchat <= range.end) {
        const montant = Number(credit.montant_total) || 0;
        totalCredits += montant;
        activites.push({
          _id: `credit:${credit._id}`,
          type: 'credit',
          createdAt: credit.date_achat || credit.createdAt,
          user_id: credit.user_id,
          site_id: credit.site_id,
          designation: credit.designation || 'Achat à crédit',
          description: `Fournisseur : ${credit.fournisseur || '-'}${credit.reference ? ` — ${credit.reference}` : ''}`,
          quantite: null,
          prix_unitaire: null,
          montant_total: montant,
          reste_a_payer: Number(credit.reste_a_payer) || 0
        });
      }

      (credit.paiements || []).forEach((paiement) => {
        const datePaiement = new Date(paiement.date_paiement);
        if (datePaiement < range.start || datePaiement > range.end) return;
        if (
          filtre.user_id &&
          String(paiement.user_id?._id || paiement.user_id) !== String(filtre.user_id)
        ) {
          return;
        }

        const montant = Number(paiement.montant) || 0;
        totalPaiementsCredits += montant;
        activites.push({
          _id: `paiement_credit:${credit._id}:${paiement._id}`,
          type: 'paiement_credit',
          createdAt: paiement.date_paiement,
          user_id: paiement.user_id || credit.user_id,
          site_id: credit.site_id,
          designation: `Paiement crédit — ${credit.designation || 'Achat'}`,
          description: `Fournisseur : ${credit.fournisseur || '-'}${paiement.reference ? ` — ${paiement.reference}` : ''}`,
          quantite: null,
          prix_unitaire: null,
          montant_total: montant
        });
      });
    });

    activites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const agentsActifs = new Set(
      activites
        .map((activite) => activite.user_id?._id || activite.user_id)
        .filter(Boolean)
        .map(String)
    ).size;

    const kpis = {
      totalVentes,
      totalServices,
      totalEntrees: totalVentes + totalServices,
      totalDepenses,
      totalDepots,
      totalCredits,
      totalPaiementsCredits,
      // Le dépôt transfère l'argent de la caisse vers la banque ;
      // il diminue donc le solde de caisse. Un crédit non payé n'affecte pas encore la caisse.
      soldeNet: totalVentes + totalServices - totalDepenses - totalDepots - totalPaiementsCredits,
      nombreOperations: activites.length,
      secretairesActifs: agentsActifs
    };

    res.json({
      activites,
      kpis,
      // Compatibilité avec les anciens consommateurs de cette route.
      totalVentes: kpis.totalVentes,
      totalServices: kpis.totalServices,
      totalDepenses: kpis.totalDepenses,
      solde: kpis.soldeNet
    });
  } catch (error) {
    console.error('Erreur supervision caisse :', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération de la supervision caisse.',
      error: error.message
    });
  }
});

// Secrétaire : uniquement sa propre caisse/journal financier.
router.get('/mienne', verifyToken, async (req, res) => {
  try {
    if (!peutVoirCaissePropre(req)) {
      return res.status(403).json({
        message: 'Vous n’êtes pas autorisé à consulter votre caisse.'
      });
    }

    const userId = getUserId(req);
    const siteId = getSiteId(req);
    const range = dateRange(req.query.date);

    if (!userId || !siteId) {
      return res.status(403).json({
        message: 'Votre compte est incomplet : utilisateur ou site introuvable.'
      });
    }

    if (!range) {
      return res.status(400).json({ message: 'Date invalide.' });
    }

    const activites = await Activite.find({
      site_id: siteId,
      user_id: userId,
      type: { $in: ['vente', 'impression', 'depense'] },
      createdAt: { $gte: range.start, $lte: range.end }
    })
      .populate('site_id', 'nom ville')
      .sort({ createdAt: -1 })
      .lean();

    let recettes = 0;
    let depenses = 0;

    for (const activite of activites) {
      const montant = Number(
        activite.montant_total ??
        activite.montant ??
        ((activite.quantite || 0) * (activite.prix_unitaire || 0))
      ) || 0;

      if (activite.type === 'depense') depenses += montant;
      else recettes += montant;
    }

    res.json({
      activites,
      recettes,
      depenses,
      solde: recettes - depenses
    });
  } catch (error) {
    console.error('Erreur caisse personnelle :', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération de votre caisse.',
      error: error.message
    });
  }
});

module.exports = router;
