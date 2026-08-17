const express = require('express');
const router = express.Router();

const Credit = require('../models/Credit');
const { verifyToken } = require('../middleware/authMiddleware');
const { estDirecteur, peutGererCredit } = require('../middleware/permissions');

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

function peutAccederAuCredit(req, credit) {
  return estDirecteur(req) || (
    String(credit.site_id) === String(getSiteId(req)) &&
    String(credit.user_id) === String(getUserId(req))
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
      const siteId = getSiteId(req);
      const userId = getUserId(req);
      if (!siteId || !userId) {
        return res.status(403).json({ message: 'Compte utilisateur ou site introuvable.' });
      }
      filtre.site_id = siteId;
      filtre.user_id = userId;
    }

    if (req.query.statut && ['ouvert', 'partiellement_paye', 'solde'].includes(req.query.statut)) {
      filtre.statut = req.query.statut;
    }

    const credits = await Credit.find(filtre)
      .populate('site_id', 'nom ville')
      .populate('user_id', 'username email poste')
      .populate('paiements.user_id', 'username email poste')
      .sort({ date_achat: -1, createdAt: -1 });

    res.json(credits);
  } catch (error) {
    console.error('Erreur récupération crédits :', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des crédits.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    if (!peutGererCredit(req)) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à enregistrer un crédit." });
    }

    const userId = getUserId(req);
    const siteId = getSiteId(req);
    const montantTotal = Number(req.body.montant_total);
    const dateAchat = req.body.date_achat ? dateValide(req.body.date_achat) : new Date();

    if (!userId || !siteId) {
      return res.status(403).json({ message: 'Votre compte doit être rattaché à un site.' });
    }
    if (!String(req.body.fournisseur || '').trim()) {
      return res.status(400).json({ message: 'Le fournisseur est obligatoire.' });
    }
    if (!String(req.body.designation || '').trim()) {
      return res.status(400).json({ message: "La désignation de l'achat est obligatoire." });
    }
    if (!Number.isFinite(montantTotal) || montantTotal <= 0) {
      return res.status(400).json({ message: 'Le montant total doit être supérieur à 0.' });
    }
    if (!dateAchat) {
      return res.status(400).json({ message: "La date d'achat est invalide." });
    }

    const credit = await new Credit({
      fournisseur: String(req.body.fournisseur).trim(),
      designation: String(req.body.designation).trim(),
      montant_total: montantTotal,
      reference: String(req.body.reference || '').trim(),
      note: String(req.body.note || '').trim(),
      date_achat: dateAchat,
      site_id: siteId,
      user_id: userId
    }).save();

    await credit.populate([
      { path: 'site_id', select: 'nom ville' },
      { path: 'user_id', select: 'username email poste' }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('credit_ajoute', credit);
      io.to('role_directeur').emit('credit_ajoute', credit);
    }

    res.status(201).json({ message: 'Crédit fournisseur enregistré.', credit });
  } catch (error) {
    console.error('Erreur création crédit :', error);
    res.status(500).json({ message: "Erreur lors de l'enregistrement du crédit." });
  }
});

router.post('/:id/paiements', verifyToken, async (req, res) => {
  try {
    if (!peutGererCredit(req)) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à enregistrer un paiement." });
    }

    const credit = await Credit.findById(req.params.id);
    if (!credit) {
      return res.status(404).json({ message: 'Crédit introuvable.' });
    }
    if (!peutAccederAuCredit(req, credit)) {
      return res.status(403).json({ message: 'Accès refusé à ce crédit.' });
    }

    const montant = Number(req.body.montant);
    const datePaiement = req.body.date_paiement ? dateValide(req.body.date_paiement) : new Date();
    if (!Number.isFinite(montant) || montant <= 0) {
      return res.status(400).json({ message: 'Le montant payé doit être supérieur à 0.' });
    }
    if (montant > Number(credit.reste_a_payer)) {
      return res.status(400).json({ message: `Le paiement dépasse le reste à payer (${credit.reste_a_payer} FCFA).` });
    }
    if (!datePaiement) {
      return res.status(400).json({ message: 'La date de paiement est invalide.' });
    }

    credit.paiements.push({
      montant,
      date_paiement: datePaiement,
      reference: String(req.body.reference || '').trim(),
      note: String(req.body.note || '').trim(),
      user_id: getUserId(req)
    });
    await credit.save();
    await credit.populate([
      { path: 'site_id', select: 'nom ville' },
      { path: 'user_id', select: 'username email poste' },
      { path: 'paiements.user_id', select: 'username email poste' }
    ]);

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${credit.user_id._id || credit.user_id}`).emit('credit_paiement_ajoute', credit);
      io.to('role_directeur').emit('credit_paiement_ajoute', credit);
    }

    res.json({ message: 'Paiement de crédit enregistré.', credit });
  } catch (error) {
    console.error('Erreur paiement crédit :', error);
    res.status(500).json({ message: "Erreur lors de l'enregistrement du paiement." });
  }
});

module.exports = router;
