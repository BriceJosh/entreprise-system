const express = require('express');
const router = express.Router();

const DepotBanque = require('../models/DepotBanque');
const { verifyToken } = require('../middleware/authMiddleware');
const { estDirecteur, peutFaireDepotBanque } = require('../middleware/permissions');

function getUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id;
}

function getSiteId(req) {
  return req.user?.site_id?._id || req.user?.site_id || req.user?.site?._id;
}

function dateValide(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) ? date : null;
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
      const siteId = getSiteId(req);
      const userId = getUserId(req);
      if (!siteId || !userId) {
        return res.status(403).json({ message: 'Compte utilisateur ou site introuvable.' });
      }
      filtre.site_id = siteId;
      filtre.user_id = userId;
    }

    const depots = await DepotBanque.find(filtre)
      .populate('site_id', 'nom ville')
      .populate('user_id', 'username email poste')
      .sort({ date_depot: -1, createdAt: -1 });

    res.json(depots);
  } catch (error) {
    console.error('Erreur récupération dépôts bancaires :', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des dépôts bancaires.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    if (!peutFaireDepotBanque(req)) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à enregistrer un dépôt bancaire." });
    }

    const userId = getUserId(req);
    const siteId = getSiteId(req);
    const montant = Number(req.body.montant);
    const dateDepot = req.body.date_depot ? dateValide(req.body.date_depot) : new Date();

    if (!userId || !siteId) {
      return res.status(403).json({ message: 'Votre compte doit être rattaché à un site.' });
    }
    if (!Number.isFinite(montant) || montant <= 0) {
      return res.status(400).json({ message: 'Le montant du dépôt doit être supérieur à 0.' });
    }
    if (!dateDepot) {
      return res.status(400).json({ message: 'La date du dépôt est invalide.' });
    }

    const depot = await new DepotBanque({
      banque: String(req.body.banque || 'Banque').trim(),
      montant,
      reference: String(req.body.reference || '').trim(),
      note: String(req.body.note || '').trim(),
      date_depot: dateDepot,
      site_id: siteId,
      user_id: userId
    }).save();

    await depot.populate([
      { path: 'site_id', select: 'nom ville' },
      { path: 'user_id', select: 'username email poste' }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('depot_banque_ajoute', depot);
      io.to('role_directeur').emit('depot_banque_ajoute', depot);
    }

    res.status(201).json({ message: 'Dépôt bancaire enregistré.', depot });
  } catch (error) {
    console.error('Erreur création dépôt bancaire :', error);
    res.status(500).json({ message: "Erreur lors de l'enregistrement du dépôt bancaire." });
  }
});

module.exports = router;
