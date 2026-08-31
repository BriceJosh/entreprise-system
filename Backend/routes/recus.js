const express = require('express');
const router = express.Router();

const Recu = require('../models/Recu');
const Activite = require('../models/Activite');
const Stock = require('../models/Stock');
const Site = require('../models/Site');

const {
  verifyToken
} = require('../middleware/authMiddleware');

/*
 * =========================================================
 * UTILITAIRES
 * =========================================================
 */

function escapeRegex(text) {
  return String(text).replace(
    /[-[\]{}()*+?.,\\^$|#\s]/g,
    '\\$&'
  );
}

function obtenirUserId(req) {
  return (
    req.user?.userId ||
    req.user?.id ||
    req.user?._id
  );
}

function normaliserOptionVente(option) {
  const valeur = String(option || '')
    .trim()
    .toLowerCase();

  if (valeur === 'gros') {
    return 'Gros';
  }

  if (
    valeur === 'détail' ||
    valeur === 'detail'
  ) {
    return 'Détail';
  }

  return 'Pièce';
}

/*
 * =========================================================
 * POST /api/recus
 * =========================================================
 *
 * CRÉER UN REÇU AVEC UNE OU PLUSIEURS LIGNES DE VENTE
 *
 * Body :
 *
 * {
 *   nom_client: "Client X" (facultatif),
 *   montant_paye: 10000 (facultatif),
 *   lignes: [
 *     {
 *       designation: "Stylo",
 *       quantite: 2,
 *       option_vente: "Détail"
 *     },
 *     ...
 *   ]
 * }
 *
 * Pour chaque ligne :
 *
 * - L'article est retrouvé dans le stock du site.
 * - Le prix est récupéré automatiquement depuis le stock.
 * - La quantité est convertie en unités de base.
 * - Le stock est décrémenté.
 * - Une activité de type "vente" est créée.
 *
 * En cas d'erreur sur une ligne, TOUTE l'opération est
 * annulée (transaction logique).
 * =========================================================
 */

router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      nom_client,
      montant_paye,
      servi_par,
      lignes
    } = req.body;

    const userId = obtenirUserId(req);

    const siteId =
      req.user?.site_id;

    if (!userId) {
      return res.status(401).json({
        message: 'Utilisateur introuvable.'
      });
    }

    if (!siteId) {
      return res.status(400).json({
        message:
          'Votre compte n’est associé à aucun site.'
      });
    }

    /*
     * =====================================================
     * VALIDATION DES LIGNES
     * =====================================================
     */

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({
        message:
          'Le reçu doit contenir au moins un article.'
      });
    }

    /*
     * =====================================================
     * TRAITEMENT DE CHAQUE LIGNE
     * =====================================================
     */

    const lignesRecu = [];
    const activitesCreees = [];
    const stocksModifies = new Map();

    let montantTotal = 0;

    for (const ligne of lignes) {
      const typeLigne = (ligne?.type === 'impression' || ligne?.type === 'service') ? 'impression' : 'vente';

      const designation = String(
        ligne?.designation || ''
      ).trim();

      const quantiteSaisie = Number(ligne?.quantite);

      if (!designation) {
        throw new Error(
          'Chaque ligne doit avoir une désignation.'
        );
      }

      if (
        !Number.isFinite(quantiteSaisie) ||
        quantiteSaisie <= 0
      ) {
        throw new Error(
          `Quantité invalide pour "${designation}".`
        );
      }

      /*
       * =====================================================
       * TRAITEMENT LIGNE DE SERVICE (IMPRESSION / GRAND FORMAT)
       * =====================================================
       */
      if (typeLigne === 'impression') {
        const prixUnitaire = Number(ligne?.prix_unitaire) || 0;
        const numLongueur = ligne?.longueur != null && ligne?.longueur !== '' ? Number(ligne.longueur) : null;
        const numLargeur = ligne?.largeur != null && ligne?.largeur !== '' ? Number(ligne.largeur) : null;
        const numSurface = ligne?.surface_m2 != null && ligne?.surface_m2 !== '' ? Number(ligne.surface_m2) : (numLongueur && numLargeur ? Number((numLongueur * numLargeur).toFixed(4)) : null);
        const numPrixM2 = ligne?.prix_m2 != null && ligne?.prix_m2 !== '' ? Number(ligne.prix_m2) : null;
        const numPrixConception = (ligne?.avec_conception && ligne?.prix_conception != null && ligne?.prix_conception !== '')
          ? Number(ligne.prix_conception)
          : (Number(ligne?.prix_conception) > 0 ? Number(ligne.prix_conception) : 0);
        const description = String(ligne?.description || '').trim();

        const montantLigne = Math.round(quantiteSaisie * prixUnitaire) + (numPrixConception > 0 ? Math.round(numPrixConception) : 0);
        montantTotal += montantLigne;

        lignesRecu.push({
          type: 'impression',
          designation,
          description,
          quantite: quantiteSaisie,
          option_vente: 'Service',
          prix_unitaire: prixUnitaire,
          avec_conception: Boolean(ligne?.avec_conception || numPrixConception > 0),
          prix_conception: numPrixConception > 0 ? Math.round(numPrixConception) : 0,
          montant: montantLigne,
          longueur: numLongueur,
          largeur: numLargeur,
          surface_m2: numSurface,
          prix_m2: numPrixM2
        });

        continue;
      }

      /*
       * =====================================================
       * TRAITEMENT LIGNE DE VENTE (STOCK)
       * =====================================================
       */
      const optionVente =
        normaliserOptionVente(
          ligne?.option_vente
        );

      let articleStock =
        stocksModifies.get(designation.toLowerCase());

      if (!articleStock) {
        articleStock = await Stock.findOne({
          site_id: siteId,
          nom_article: {
            $regex: new RegExp(
              `^${escapeRegex(designation)}$`,
              'i'
            )
          }
        });
      }

      if (!articleStock) {
        throw new Error(
          `Article "${designation}" introuvable dans le stock.`
        );
      }

      const prixUnitaire =
        articleStock.obtenirPrixParOption(
          optionVente
        );

      if (!prixUnitaire || prixUnitaire <= 0) {
        throw new Error(
          `Aucun prix configuré pour "${articleStock.nom_article}" en mode ${optionVente}.`
        );
      }

      const quantiteUnites =
        articleStock.calculerQuantiteEnPieces(
          quantiteSaisie,
          optionVente
        );

      const stockActuel =
        Number(articleStock.quantite);

      if (stockActuel < quantiteUnites) {
        throw new Error(
          `Stock insuffisant pour "${articleStock.nom_article}" : il reste ${stockActuel} unité(s).`
        );
      }

      articleStock.quantite =
        Math.max(
          0,
          stockActuel - quantiteUnites
        );

      stocksModifies.set(
        designation.toLowerCase(),
        articleStock
      );

      const montantLigne =
        quantiteSaisie * prixUnitaire;

      montantTotal += montantLigne;

      lignesRecu.push({
        type: 'vente',
        designation: articleStock.nom_article,
        quantite: quantiteSaisie,
        option_vente: optionVente,
        prix_unitaire: prixUnitaire,
        montant: montantLigne
      });
    }

    /*
     * =====================================================
     * SAUVEGARDE DES STOCKS
     * =====================================================
     */

    for (const article of stocksModifies.values()) {
      await article.save();
    }

    /*
     * =====================================================
     * INFOS DU SITE FIGÉES SUR LE REÇU
     * =====================================================
     *
     * Le nom et le téléphone de l'agence sont copiés sur
     * le reçu au moment de sa création : l'impression reste
     * correcte même si le numéro du site change plus tard.
     */

    const siteDoc = await Site.findById(siteId).select(
      'nom telephone'
    );

    /*
     * =====================================================
     * CRÉATION DU REÇU
     * =====================================================
     */

    const numeroRecu = `REC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const recu = new Recu({
      numero: numeroRecu,

      lignes: [],

      montant_total: montantTotal,

      montant_paye:
        Number.isFinite(Number(montant_paye)) &&
        Number(montant_paye) > 0
          ? Number(montant_paye)
          : null,

      monnaie_rendue:
        Number.isFinite(Number(montant_paye)) &&
        Number(montant_paye) >= montantTotal
          ? Number(montant_paye) - montantTotal
          : null,

      nom_client:
        String(nom_client || '').trim(),

      servi_par:
        String(servi_par || '').trim(),

      site_id: siteId,

      site_nom:
        String(siteDoc?.nom || '').trim(),

      site_telephone:
        String(siteDoc?.telephone || '').trim(),

      user_id: userId
    });

    await recu.save();

    /*
     * =====================================================
     * CRÉATION DES ACTIVITÉS (VENTES & IMPRESSIONS / SERVICES)
     * =====================================================
     */

    for (const ligne of lignesRecu) {
      let activite;

      if (ligne.type === 'impression') {
        activite = new Activite({
          type: 'impression',
          designation: ligne.designation,
          description: ligne.description || '',
          quantite: ligne.quantite,
          quantite_unites: ligne.quantite,
          prix_unitaire: ligne.prix_unitaire,
          avec_conception: Boolean(ligne.avec_conception),
          prix_conception: Number(ligne.prix_conception) || 0,
          montant_total: ligne.montant,
          longueur: ligne.longueur,
          largeur: ligne.largeur,
          surface_m2: ligne.surface_m2,
          prix_m2: ligne.prix_m2,
          recu_id: recu._id,
          site_id: siteId,
          user_id: userId
        });
      } else {
        activite = new Activite({
          type: 'vente',
          designation: ligne.designation,
          quantite: ligne.quantite,
          quantite_unites:
            ligne.quantite *
            (optionVenteMultiplicateur(
              stocksModifies,
              ligne.designation,
              ligne.option_vente
            ) || 1),
          prix_unitaire: ligne.prix_unitaire,
          montant_total: ligne.montant,
          option_vente: ligne.option_vente,
          recu_id: recu._id,
          site_id: siteId,
          user_id: userId
        });
      }

      await activite.save();
      activitesCreees.push(activite);
      ligne.activite_id = activite._id;
    }

    /*
     * =====================================================
     * SAUVEGARDE DES LIGNES DANS LE REÇU
     * =====================================================
     */

    recu.lignes = lignesRecu;

    await recu.save();

    /*
     * =====================================================
     * SOCKET
     * =====================================================
     */

    const io = req.app.get('io');

    if (io) {
      io.emit('recu_cree', recu);

      for (const article of stocksModifies.values()) {
        io.emit('stock_mis_a_jour', article);
      }

      for (const activite of activitesCreees) {
        io.emit('activite_ajoutee', activite);
      }
    }

    /*
     * =====================================================
     * RÉPONSE
     * =====================================================
     */

    return res.status(201).json({
      message:
        'Reçu généré avec succès.',

      recu,

      activites: activitesCreees
    });
  } catch (error) {
    console.error(
      'Erreur création reçu :',
      error
    );

    return res.status(400).json({
      message:
        error.message ||
        'Erreur lors de la création du reçu.'
    });
  }
});

/*
 * =========================================================
 * FONCTION UTILITAIRE : MULTIPLICATEUR
 * =========================================================
 */

function optionVenteMultiplicateur(
  stocksModifies,
  designation,
  optionVente
) {
  const article =
    stocksModifies.get(
      String(designation).toLowerCase()
    );

  if (!article) {
    return 1;
  }

  if (optionVente === 'Gros') {
    return (
      Number(article.multiplicateur_gros) || 1
    );
  }

  if (optionVente === 'Détail') {
    return (
      Number(article.multiplicateur_detail) || 1
    );
  }

  return 1;
}

/*
 * =========================================================
 * GET /api/recus
 * =========================================================
 *
 * LISTE DES REÇUS
 *
 * - Secrétaire : uniquement ses propres reçus.
 * - Directeur : tous les reçus (ou par site).
 * =========================================================
 */

router.get('/', verifyToken, async (req, res) => {
  try {
    let filtre = {};

    if (req.user.role === 'directeur') {
      if (
        req.query.site_id &&
        req.query.site_id !== 'TOUS' &&
        req.query.site_id !== 'tous'
      ) {
        filtre.site_id = req.query.site_id;
      }
    } else {
      filtre.site_id = req.user.site_id;

      if (req.query.mes_recus === 'true') {
        filtre.user_id = obtenirUserId(req);
      }
    }

    const recus = await Recu.find(filtre)
      .populate('user_id', 'username poste')
      .populate('site_id', 'nom telephone')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limite) || 100);

    return res.json(recus);
  } catch (error) {
    console.error(
      'Erreur récupération reçus :',
      error
    );

    return res.status(500).json({
      message:
        'Erreur lors de la récupération des reçus.'
    });
  }
});

/*
 * =========================================================
 * GET /api/recus/:id
 * =========================================================
 *
 * DÉTAIL D'UN REÇU (pour réimpression)
 * =========================================================
 */

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        message: 'Identifiant de reçu invalide.'
      });
    }

    const recu = await Recu.findById(id)
      .populate('user_id', 'username poste')
      .populate('site_id', 'nom telephone');

    if (!recu) {
      return res.status(404).json({
        message: 'Reçu introuvable.'
      });
    }

    /*
     * Une secrétaire ne peut consulter que les reçus
     * de son propre site.
     */

    if (
      req.user.role !== 'directeur' &&
      String(recu.site_id?._id || recu.site_id) !==
        String(req.user.site_id)
    ) {
      return res.status(403).json({
        message:
          "Vous n'êtes pas autorisé à consulter ce reçu."
      });
    }

    return res.json(recu);
  } catch (error) {
    console.error(
      'Erreur récupération reçu :',
      error
    );

    return res.status(500).json({
      message:
        'Erreur lors de la récupération du reçu.'
    });
  }
});

module.exports = router;
