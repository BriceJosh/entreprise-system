const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Activite = require('../models/Activite');
const Stock = require('../models/Stock');

const {
  verifyToken
} = require('../middleware/authMiddleware');

const {
  peutFaireServices,
  peutFaireVente
} = require('../middleware/permissions');

/*
 * =========================================================
 * GET /api/activites
 * =========================================================
 */

router.get('/', verifyToken, async (req, res) => {
  try {
    let filtre = {};

    /*
     * DIRECTEUR
     * =========
     * Peut voir toutes les activités.
     */

    if (req.user.role === 'directeur') {
      if (
        req.query.site_id &&
        req.query.site_id !== 'TOUS' &&
        req.query.site_id !== 'tous' &&
        req.query.site_id !== 'null' &&
        req.query.site_id !== 'undefined'
      ) {
        filtre.site_id = req.query.site_id;
      }
    }

    /*
     * SECRÉTAIRE
     * ==========
     * Voit uniquement ses propres activités
     * sur son propre site.
     */

    else if (req.user.role === 'secretaire') {
      if (!req.user.site_id) {
        return res.status(403).json({
          message: 'Votre compte n’est associé à aucun site.'
        });
      }

      if (!req.user.userId) {
        return res.status(403).json({
          message: 'Impossible d’identifier votre compte.'
        });
      }

      filtre.site_id = req.user.site_id;
      filtre.user_id = req.user.userId;
    }

    const activites = await Activite.find(filtre)
      .populate(
        'user_id',
        'username email poste'
      )
      .populate(
        'site_id',
        'nom'
      )
      .sort({
        createdAt: -1
      });

    res.json(activites);

  } catch (error) {

    console.error(
      'Erreur récupération activités :',
      error
    );

    res.status(500).json({
      message:
        'Erreur lors de la récupération des activités.',
      error:
        error.message
    });
  }
});

/*
 * =========================================================
 * POST /api/activites
 * =========================================================
 *
 * Gestion :
 *
 * - impression
 * - vente
 *
 * Pour une vente :
 *
 * quantite
 * option_vente
 * quantite_unites
 *
 * sont enregistrés.
 *
 * Le stock est décrémenté en unités de base.
 *
 * Exemple :
 *
 * Stock :
 * 2000 unités
 *
 * Vente :
 * 2 Gros
 *
 * multiplicateur_gros = 1000
 *
 * quantite_unites = 2 × 1000
 *                 = 2000
 *
 * Nouveau stock :
 * 0
 *
 * =========================================================
 */

router.post('/', verifyToken, async (req, res) => {

  try {

    const {
      type,
      designation,
      description,
      quantite,
      prix_unitaire,
      option_vente,
      produit_id,
      article_id,
      longueur,
      largeur,
      surface_m2,
      prix_m2
    } = req.body;

    /*
     * =====================================================
     * UTILISATEUR
     * =====================================================
     */

    const userId =
      req.user?.userId ||
      req.user?.id ||
      req.user?._id;

    const siteId =
      req.user?.site_id ||
      req.user?.site?._id;

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
     * TYPE
     * =====================================================
     */

    const typeOperation =
      type || 'vente';

    /*
     * =====================================================
     * AUTORISATION SERVICE
     * =====================================================
     */

    if (typeOperation === 'impression') {

      if (!peutFaireServices(req)) {
        return res.status(403).json({
          message:
            "Vous n'êtes pas autorisé à enregistrer des services ou impressions."
        });
      }
    }

    /*
     * =====================================================
     * AUTORISATION VENTE
     * =====================================================
     */

    if (typeOperation === 'vente') {

      if (!peutFaireVente(req)) {
        return res.status(403).json({
          message:
            "Vous n'êtes pas autorisé à enregistrer des ventes."
        });
      }
    }

    /*
     * =====================================================
     * NORMALISATION DE L'OPTION DE VENTE
     * =====================================================
     */

    let modeOptionVente = '';

    if (typeOperation === 'vente') {

      const optionNettoyee = String(
        option_vente || ''
      )
        .trim()
        .toLowerCase();

      if (optionNettoyee === 'gros') {

        modeOptionVente = 'Gros';

      } else if (
        optionNettoyee === 'détail' ||
        optionNettoyee === 'detail'
      ) {

        modeOptionVente = 'Détail';

      } else {

        modeOptionVente = 'Pièce';
      }
    }

    /*
     * =====================================================
     * QUANTITÉ SAISIE
     * =====================================================
     */

    const qteSaisie = Number(quantite);

    if (
      !Number.isFinite(qteSaisie) ||
      qteSaisie <= 0
    ) {
      return res.status(400).json({
        message:
          'La quantité doit être supérieure à 0.'
      });
    }

    /*
     * =====================================================
     * PRIX
     * =====================================================
     *
     * Pour une VENTE, le prix est récupéré AUTOMATIQUEMENT
     * depuis le stock selon le mode de vente.
     *
     * Pour un SERVICE (impression), le prix reste saisi.
     */

    let prixUnitaire = 0;

    if (typeOperation !== 'vente') {
      prixUnitaire = Number(
        prix_unitaire
      );

      if (
        !Number.isFinite(prixUnitaire) ||
        prixUnitaire < 0
      ) {
        return res.status(400).json({
          message:
            'Le prix de vente est invalide.'
        });
      }
    }

    /*
     * =====================================================
     * ARTICLE STOCK
     * =====================================================
     */

    let articleStock = null;

    /*
     * =====================================================
     * VENTE
     * =====================================================
     */

    if (typeOperation === 'vente') {

      /*
       * -----------------------------------------------------
       * RECHERCHE PAR ID
       * -----------------------------------------------------
       */

      const targetId =
        produit_id ||
        article_id;

      if (
        targetId &&
        mongoose.Types.ObjectId.isValid(targetId)
      ) {

        articleStock =
          await Stock.findOne({
            _id: targetId,
            site_id: siteId
          });
      }

      /*
       * -----------------------------------------------------
       * RECHERCHE PAR NOM
       * -----------------------------------------------------
       */

      if (
        !articleStock &&
        designation
      ) {

        const designationClean =
          String(designation)
            .trim()
            .replace(
              /[-[\]{}()*+?.,\\^$|#\s]/g,
              '\\$&'
            );

        articleStock =
          await Stock.findOne({
            site_id: siteId,
            nom_article: {
              $regex:
                new RegExp(
                  `^${designationClean}$`,
                  'i'
                )
            }
          });
      }

      /*
       * -----------------------------------------------------
       * ARTICLE INTROUVABLE
       * -----------------------------------------------------
       */

      if (!articleStock) {

        return res.status(404).json({
          message:
            `Vente annulée : l'article "${designation}" est introuvable dans le stock de votre site.`
        });
      }

      /*
       * -----------------------------------------------------
       * PRIX RÉCUPÉRÉ AUTOMATIQUEMENT DEPUIS LE STOCK
       * -----------------------------------------------------
       */

      prixUnitaire =
        articleStock.obtenirPrixParOption(
          modeOptionVente
        );

      if (
        !prixUnitaire ||
        prixUnitaire <= 0
      ) {
        return res.status(400).json({
          message:
            `Aucun prix de vente configuré pour "${articleStock.nom_article}" en mode ${modeOptionVente}.`
        });
      }

      /*
       * -----------------------------------------------------
       * VÉRIFICATION DU MODE GROS
       * -----------------------------------------------------
       */

      if (
        modeOptionVente === 'Gros'
      ) {

        const piecesPourUnGros =
          articleStock.calculerQuantiteEnPieces(
            1,
            'Gros'
          );

        if (
          !piecesPourUnGros ||
          piecesPourUnGros <= 1
        ) {

          return res.status(400).json({
            message:
              `L'article "${articleStock.nom_article}" n'est pas configuré pour la vente en Gros.`
          });
        }
      }

      /*
       * -----------------------------------------------------
       * CALCUL DE LA QUANTITÉ RÉELLE EN UNITÉS
       * -----------------------------------------------------
       *
       * Pièce :
       *
       * 3 × 1 = 3
       *
       * Détail :
       *
       * 5 × multiplicateur_detail
       *
       * Gros :
       *
       * 2 × multiplicateur_gros
       *
       * -----------------------------------------------------
       */

      const qteUnites =
        articleStock.calculerQuantiteEnPieces(
          qteSaisie,
          modeOptionVente
        );

      if (
        !Number.isFinite(qteUnites) ||
        qteUnites <= 0
      ) {

        return res.status(400).json({
          message:
            'Impossible de calculer la quantité réelle en unités.'
        });
      }

      /*
       * -----------------------------------------------------
       * STOCK INSUFFISANT
       * -----------------------------------------------------
       */

      if (
        Number(articleStock.quantite) <
        qteUnites
      ) {

        return res.status(400).json({
          message:
            `Stock insuffisant : il reste ${articleStock.quantite} unité(s), mais la vente demande ${qteUnites} unité(s).`
        });
      }

      /*
       * -----------------------------------------------------
       * DÉCRÉMENTATION DU STOCK
       * -----------------------------------------------------
       */

      articleStock.quantite =
        Number(articleStock.quantite) -
        qteUnites;

      /*
       * -----------------------------------------------------
       * ARRONDISSEMENT DE SÉCURITÉ
       * -----------------------------------------------------
       */

      articleStock.quantite =
        Math.max(
          0,
          articleStock.quantite
        );

      /*
       * -----------------------------------------------------
       * CRÉATION ACTIVITÉ
       * -----------------------------------------------------
       */

      const nouvelleActivite =
        new Activite({

          type: 'vente',

          designation:
            String(designation || '').trim(),

          description:
            description || '',

          /*
           * Quantité visible :
           *
           * 2 Gros
           * 5 Détail
           * 3 Pièce
           */

          quantite:
            qteSaisie,

          /*
           * Quantité réellement retirée du stock :
           *
           * 2000 unités
           * 250 unités
           * 3 unités
           */

          quantite_unites:
            qteUnites,

          prix_unitaire:
            prixUnitaire,

          option_vente:
            modeOptionVente,

          site_id:
            siteId,

          user_id:
            userId
        });

      /*
       * Sauvegarde de l'activité
       */

      await nouvelleActivite.save();

      /*
       * Sauvegarde du stock
       */

      await articleStock.save();

      /*
       * =====================================================
       * POPULATION
       * =====================================================
       */

      await nouvelleActivite.populate(
        'site_id',
        'nom'
      );

      await nouvelleActivite.populate(
        'user_id',
        'username email poste'
      );

      /*
       * =====================================================
       * SOCKET STOCK
       * =====================================================
       */

      const io =
        req.app.get('io');

      if (
        io &&
        articleStock
      ) {

        io.emit(
          'stock_mis_a_jour',
          articleStock
        );
      }

      /*
       * =====================================================
       * SOCKET ACTIVITÉ
       * =====================================================
       */

      if (io) {

        io.emit(
          'activite_ajoutee',
          nouvelleActivite
        );
      }

      /*
       * =====================================================
       * RÉPONSE
       * =====================================================
       */

      return res.status(201).json(
        nouvelleActivite
      );
    }

    /*
     * =====================================================
     * IMPRESSION / SERVICE
     * =====================================================
     */

    if (
      typeOperation === 'impression'
    ) {

      const parsedLongueur = longueur != null && longueur !== '' ? Number(longueur) : null;
      const parsedLargeur = largeur != null && largeur !== '' ? Number(largeur) : null;
      const parsedPrixM2 = prix_m2 != null && prix_m2 !== '' ? Number(prix_m2) : null;
      let calculatedSurface = null;
      let finalPrixUnitaire = prixUnitaire;

      if (parsedLongueur > 0 && parsedLargeur > 0) {
        calculatedSurface = Number((parsedLongueur * parsedLargeur).toFixed(4));
        if (parsedPrixM2 > 0 && (!finalPrixUnitaire || finalPrixUnitaire === 0)) {
          finalPrixUnitaire = Math.round(calculatedSurface * parsedPrixM2);
        }
      }

      const nouvelleActivite =
        new Activite({

          type: 'impression',

          designation:
            designation ||
            'Service',

          description:
            description || '',

          quantite:
            qteSaisie,

          quantite_unites:
            qteSaisie,

          prix_unitaire:
            finalPrixUnitaire,

          longueur:
            parsedLongueur,

          largeur:
            parsedLargeur,

          surface_m2:
            calculatedSurface,

          prix_m2:
            parsedPrixM2,

          site_id:
            siteId,

          user_id:
            userId
        });

      await nouvelleActivite.save();

      await nouvelleActivite.populate(
        'site_id',
        'nom'
      );

      await nouvelleActivite.populate(
        'user_id',
        'username email poste'
      );

      const io =
        req.app.get('io');

      if (io) {

        io.emit(
          'activite_ajoutee',
          nouvelleActivite
        );
      }

      return res.status(201).json(
        nouvelleActivite
      );
    }

    /*
     * =====================================================
     * TYPE INCONNU
     * =====================================================
     */

    return res.status(400).json({
      message:
        "Type d'activité non pris en charge."
    });

  } catch (error) {

    console.error(
      'Erreur enregistrement activité :',
      error
    );

    res.status(500).json({
      message:
        "Erreur serveur lors de l'enregistrement.",
      error:
        error.message
    });
  }
});

module.exports = router;