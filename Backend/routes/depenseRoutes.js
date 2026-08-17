const express = require('express');
const router = express.Router();

const Depense = require('../models/Depense');
const Activite = require('../models/Activite');

const { verifyToken } = require('../middleware/authMiddleware');
const { peutFaireDepense, estDirecteur } = require('../middleware/permissions');

function getUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || req.user?._id;
}

function getSiteId(req) {
  return (
    req.user?.site_id?._id ||
    req.user?.site_id ||
    req.user?.site?._id ||
    req.user?.site?.id
  );
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const filtre = {};

    if (estDirecteur(req)) {
      if (
        req.query.site_id &&
        req.query.site_id !== 'TOUS' &&
        req.query.site_id !== 'tous' &&
        req.query.site_id !== 'null' &&
        req.query.site_id !== 'undefined'
      ) {
        filtre.site_id = req.query.site_id;
      }
    } else {
      const userId = getUserId(req);
      const siteId = getSiteId(req);

      if (!userId || !siteId) {
        return res.status(403).json({
          message: 'Votre compte est incomplet : utilisateur ou site introuvable.'
        });
      }

      // Dépenses personnelles : même règle que le journal/caisse.
      filtre.site_id = siteId;
      filtre.user_id = userId;
    }

    const depenses = await Depense.find(filtre)
      .populate('site_id', 'nom ville')
      .populate('user_id', 'username email role poste')
      .sort({ createdAt: -1 });

    res.status(200).json(depenses);
  } catch (error) {
    console.error('Erreur récupération dépenses :', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des dépenses.',
      error: error.message
    });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    if (!peutFaireDepense(req)) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à enregistrer des dépenses."
      });
    }

    const { motif, montant } = req.body;
    const userId = getUserId(req);
    const siteId = getSiteId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Utilisateur non identifié.' });
    }

    if (!siteId) {
      return res.status(400).json({
        message: 'Votre compte n’est pas rattaché à un site.'
      });
    }

    if (!motif || !String(motif).trim()) {
      return res.status(400).json({
        message: 'Le motif de la dépense est obligatoire.'
      });
    }

    const montantNumerique = Number(montant);
    if (!Number.isFinite(montantNumerique) || montantNumerique <= 0) {
      return res.status(400).json({
        message: 'Le montant de la dépense doit être supérieur à 0.'
      });
    }

    const nouvelleDepense = new Depense({
      motif: String(motif).trim(),
      montant: montantNumerique,
      site_id: siteId,
      user_id: userId,
      date: new Date()
    });

    const depenseSauvegardee = await nouvelleDepense.save();

    let activiteDepense = null;

    try {
      activiteDepense = new Activite({
        type: 'depense',
        designation: String(motif).trim(),
        description: `Dépense : ${String(motif).trim()}`,
        quantite: 1,
        prix_unitaire: montantNumerique,
        montant_total: montantNumerique,
        site_id: siteId,
        user_id: userId
      });

      await activiteDepense.save();
    } catch (activiteError) {
      console.error('Erreur création activité dépense :', activiteError);
    }

    const depenseComplete = await Depense.findById(depenseSauvegardee._id)
      .populate('site_id', 'nom ville')
      .populate('user_id', 'username email role poste');

    if (activiteDepense) {
      await activiteDepense.populate([
        { path: 'site_id', select: 'nom ville' },
        { path: 'user_id', select: 'username email role poste' }
      ]);
    }

    const io = req.app.get('io');

    if (io) {
      const userRoom = `user_${userId}`;
      io.to(userRoom).emit('depense_ajoutee', depenseComplete);

      if (activiteDepense) {
        io.to(userRoom).emit('activite_ajoutee', activiteDepense);
      }

      io.to('role_directeur').emit('depense_ajoutee', depenseComplete);
      if (activiteDepense) {
        io.to('role_directeur').emit('activite_ajoutee', activiteDepense);
      }
    }

    res.status(201).json({
      message: 'Dépense enregistrée avec succès.',
      depense: depenseComplete,
      activite: activiteDepense
    });
  } catch (error) {
    console.error('Erreur création dépense :', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Données de dépense invalides.',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      message: 'Erreur lors de la création de la dépense.',
      error: error.message
    });
  }
});

module.exports = router;
