const express = require('express');
const router = express.Router();

const Stock = require('../models/Stock');
const StockMouvement = require('../models/StockMouvement');
const Activite = require('../models/Activite');

const {
  verifyToken
} = require('../middleware/authMiddleware');

const {
  peutLireStock,
  peutGererArticleStock,
  peutFaireDecoupage
} = require('../middleware/permissions');

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

/*
 * =========================================================
 * NORMALISER LE TYPE D'ENTRÉE
 * =========================================================
 */

function normaliserTypeEntree(type) {
  const valeur = String(type || '')
    .trim()
    .toLowerCase();

  if (
    valeur === 'gros'
  ) {
    return 'Gros';
  }

  if (
    valeur === 'détail' ||
    valeur === 'detail'
  ) {
    return 'Détail';
  }

  if (
    valeur === 'pièce' ||
    valeur === 'piece' ||
    valeur === 'unité' ||
    valeur === 'unite'
  ) {
    return 'Pièce';
  }

  return null;
}

/*
 * =========================================================
 * GET /api/stocks
 * =========================================================
 *
 * Récupération des stocks accessibles à l'utilisateur.
 */

router.get(
  '/',
  verifyToken,
  async (req, res) => {
    try {
      if (!peutLireStock(req)) {
        return res.status(403).json({
          message:
            "Vous n'êtes pas autorisé à consulter les stocks."
        });
      }

      let filtre = {};

      /*
       * DIRECTEUR
       *
       * Peut consulter un site précis ou tous les sites.
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
       *
       * Toujours son propre site.
       */

      else {
        if (!req.user.site_id) {
          return res.status(403).json({
            message:
              'Votre compte n’est associé à aucun site.'
          });
        }

        filtre.site_id = req.user.site_id;
      }

      const stocks = await Stock.find(filtre)
        .sort({
          nom_article: 1
        });

      res.json(stocks);
    } catch (error) {
      console.error(
        'Erreur récupération stocks :',
        error
      );

      res.status(500).json({
        message:
          'Erreur lors de la récupération des stocks.'
      });
    }
  }
);

/*
 * =========================================================
 * POST /api/stocks
 * =========================================================
 *
 * ENREGISTRER UNE ENTRÉE DE STOCK
 *
 * Nouveau fonctionnement :
 *
 * {
 *   nom_article: "Rame",
 *   quantite: 2,
 *   type_entree: "Gros",
 *   prix_vente: 1500,
 *   prix_total: 250000,
 *   seuil_alerte: 100,
 *   multiplicateur_gros: 100,
 *   multiplicateur_detail: 10
 * }
 *
 * Le backend convertit :
 *
 * 2 Gros × 100
 *
 * = 200 unités
 */

router.post(
  '/',
  verifyToken,
  async (req, res) => {
    try {
      /*
       * =====================================================
       * PERMISSION
       * =====================================================
       *
       * - Directeur : tout le stock.
       * - S3 (STOCK_GESTION) : tout le stock.
       * - S4 (STOCK_PAPIER_GESTION) : uniquement les articles
       *   papier/rame/feuille reconnus par isPaperStockItem().
       */

      if (!peutGererArticleStock(req, req.body?.nom_article)) {
        return res.status(403).json({
          message:
            "Vous n'êtes pas autorisé à gérer cet article de stock."
        });
      }

      /*
       * =====================================================
       * DONNÉES
       * =====================================================
       */

      const {
        nom_article,
        quantite,
        type_entree,
        seuil_alerte,
        site_id,
        multiplicateur_gros,
        multiplicateur_detail,
        prix_vente,
        prix_total,

        /*
         * Compatibilité temporaire avec l'ancien frontend.
         *
         * Ces champs ne seront plus utilisés par le nouveau
         * formulaire, mais leur présence évite des problèmes
         * pendant la transition.
         */
        prix_vente_unite,
        prix_vente_detail,
        prix_vente_gros
      } = req.body;

      /*
       * =====================================================
       * UTILISATEUR
       * =====================================================
       */

      const userId = obtenirUserId(req);

      if (!userId) {
        return res.status(401).json({
          message:
            "Utilisateur introuvable."
        });
      }

      /*
       * =====================================================
       * SITE AUTORISÉ
       * =====================================================
       */

      let targetSiteId;

      if (
        req.user.role === 'directeur'
      ) {
        targetSiteId =
          site_id ||
          req.user.site_id;
      } else {
        /*
         * Une secrétaire ne peut jamais choisir arbitrairement
         * un autre site.
         */

        targetSiteId =
          req.user.site_id;
      }

      if (!targetSiteId) {
        return res.status(400).json({
          message:
            'Impossible de déterminer le site du stock.'
        });
      }

      /*
       * =====================================================
       * VALIDATION NOM
       * =====================================================
       */

      if (
        !nom_article ||
        !String(nom_article).trim()
      ) {
        return res.status(400).json({
          message:
            "Le nom de l'article est obligatoire."
        });
      }

      /*
       * =====================================================
       * VALIDATION QUANTITÉ
       * =====================================================
       */

      const quantiteEntree =
        Number(quantite);

      if (
        !Number.isFinite(quantiteEntree) ||
        quantiteEntree <= 0
      ) {
        return res.status(400).json({
          message:
            "La quantité entrante doit être supérieure à zéro."
        });
      }

      /*
       * =====================================================
       * TYPE D'ENTRÉE
       * =====================================================
       */

      const typeEntreeNormalise =
        normaliserTypeEntree(
          type_entree
        );

      if (!typeEntreeNormalise) {
        return res.status(400).json({
          message:
            "Le type d'entrée doit être Gros, Détail ou Pièce."
        });
      }

      /*
        * =====================================================
        * PRIX DE VENTE MULTI-NIVEAUX
        * =====================================================
        *
        * Selon le type d'entrée, la secrétaire doit saisir :
        *
        * - Gros   : prix gros + détail + unité
        * - Détail : prix détail + unité
        * - Pièce  : prix unité uniquement
        */

      const lirePrix = valeur => {
        if (valeur === undefined || valeur === null || valeur === '') {
          return null;
        }

        const nombre = Number(valeur);

        return Number.isFinite(nombre) && nombre >= 0 ? nombre : NaN;
      };

      const prixUniteSaisi = lirePrix(
        prix_vente_unite !== undefined
          ? prix_vente_unite
          : prix_vente
      );

      const prixDetailSaisi = lirePrix(prix_vente_detail);

      const prixGrosSaisi = lirePrix(prix_vente_gros);

      if (prixUniteSaisi === null || Number.isNaN(prixUniteSaisi)) {
        return res.status(400).json({
          message:
            "Le prix de vente à l'unité est obligatoire et doit être valide."
        });
      }

      /*
        * Prix de vente unitaire utilisé pour le calcul du total.
        *
        * - Entrée en Gros   → prix à la DÉTAIL
        * - Entrée en Détail → prix à l'UNITÉ
        * - Entrée en Pièce  → prix à l'UNITÉ
        */

      let prixUnitaireCalcul;

      switch (typeEntreeNormalise) {
        case 'Gros':
          prixUnitaireCalcul = prixDetailSaisi;
          break;

        case 'Détail':
          prixUnitaireCalcul = prixUniteSaisi;
          break;

        default:
          prixUnitaireCalcul = prixUniteSaisi;
      }

      if (
        prixUnitaireCalcul === null ||
        Number.isNaN(prixUnitaireCalcul)
      ) {
        return res.status(400).json({
          message:
            typeEntreeNormalise === 'Gros'
              ? "Le prix de vente à la détail est obligatoire pour une entrée en gros."
              : "Le prix de vente à l'unité est obligatoire."
        });
      }

      /*
        * =====================================================
        * PRIX TOTAL AUTOMATIQUE
        * =====================================================
        *
        * - Entrée en Gros   :
        *     nbre de détails = qte × multGros ÷ multDétail
        *     total = nbre de détails × prix DÉTAIL
        *
        * - Entrée en Détail :
        *     nbre d'unités = qte × multDétail
        *     total = nbre d'unités × prix UNITÉ
        *
        * - Entrée en Pièce  :
        *     total = qte × prix UNITÉ
        */

      /*
        * Recherche préalable de l'article pour connaître ses
        * multiplicateurs (utile si l'article existe déjà).
        */

      const nomCleanPrix =
        escapeRegex(
          String(nom_article).trim()
        );

      const articleExistantStock =
        await Stock.findOne({
          nom_article: {
            $regex:
              new RegExp(
                `^${nomCleanPrix}$`,
                'i'
              )
          },
          site_id: targetSiteId
        });

      let prixTotal;

      if (typeEntreeNormalise === 'Gros') {
        const multGros =
          articleExistantStock?.multiplicateur_gros ?? multiplicateur_gros ?? 1;

        const multDetail =
          articleExistantStock?.multiplicateur_detail ?? multiplicateur_detail ?? 1;

        const nombreDetails =
          (quantiteEntree * Number(multGros)) /
          Math.max(1, Number(multDetail));

        prixTotal = nombreDetails * prixUnitaireCalcul;
      } else if (typeEntreeNormalise === 'Détail') {
        const multDetail =
          articleExistantStock?.multiplicateur_detail ?? multiplicateur_detail ?? 1;

        const nombreUnites =
          quantiteEntree * Number(multDetail);

        prixTotal = nombreUnites * prixUnitaireCalcul;
      } else {
        prixTotal = quantiteEntree * prixUnitaireCalcul;
      }

      const prixVente = prixUniteSaisi;

      /*
       * =====================================================
       * RECHERCHE DE L'ARTICLE
       * =====================================================
       */

      const nomClean =
        escapeRegex(
          String(nom_article).trim()
        );

      let stock =
        await Stock.findOne({
          nom_article: {
            $regex:
              new RegExp(
                `^${nomClean}$`,
                'i'
              )
          },
          site_id: targetSiteId
        });

      /*
       * =====================================================
       * ARTICLE EXISTANT
       * =====================================================
       */

      if (stock) {
        /*
         * Pour un article existant, les multiplicateurs
         * viennent du stock déjà enregistré.
         *
         * On ne les remplace PAS à chaque réapprovisionnement.
         */

        const multiplicateur =
          typeEntreeNormalise === 'Gros'
            ? stock.multiplicateur_gros || 1
            : typeEntreeNormalise === 'Détail'
              ? stock.multiplicateur_detail || 1
              : 1;

        /*
         * Conversion vers l'unité de base.
         */

        const quantiteUnites =
          quantiteEntree *
          multiplicateur;

        /*
         * Ajout au stock réel.
         */

        stock.quantite +=
          quantiteUnites;

        /*
         * Mise à jour des paramètres si envoyés.
         *
         * Le seuil peut être modifié.
         */

        if (
          seuil_alerte !== undefined
        ) {
          const seuil =
            Number(seuil_alerte);

          if (
            Number.isFinite(seuil) &&
            seuil >= 0
          ) {
            stock.seuil_alerte = seuil;
          }
        }

        /*
          * Mise à jour des prix de vente selon ce qui a été
          * saisi lors de cette entrée :
          *
          * - Prix unité : toujours mis à jour (obligatoire).
          * - Prix détail : si saisi (entrée en Gros ou Détail).
          * - Prix gros   : si saisi (entrée en Gros).
          */

        stock.prix_vente =
          prixVente;

        stock.prix_vente_unite =
          prixVente;

        if (prixDetailSaisi !== null) {
          stock.prix_vente_detail =
            prixDetailSaisi;
        }

        if (prixGrosSaisi !== null) {
          stock.prix_vente_gros =
            prixGrosSaisi;
        }

        await stock.save();

        /*
         * ===================================================
         * CRÉATION DU MOUVEMENT
         * ===================================================
         */

        const mouvement =
          await StockMouvement.create({
            stock_id: stock._id,

            nom_article:
              stock.nom_article,

            type: 'entree',

            type_entree:
              typeEntreeNormalise,

            quantite_entree:
              quantiteEntree,

            quantite_unites:
              quantiteUnites,

            multiplicateur_utilise:
              multiplicateur,

            prix_vente_unitaire:
              prixUnitaireCalcul,

            prix_total:
              prixTotal,

            seuil_alerte:
              stock.seuil_alerte,

            user_id:
              userId,

            site_id:
              targetSiteId,

            description:
              'Réapprovisionnement du stock'
          });

        /*
         * ===================================================
         * SOCKET
         * ===================================================
         */

        const io =
          req.app.get('io');

        if (io) {
          io.emit(
            'stock_mis_a_jour',
            stock
          );

          io.emit(
            'stock_mouvement_ajoute',
            mouvement
          );
        }

        return res.status(201).json({
          message:
            'Stock réapprovisionné avec succès.',

          stock,

          mouvement,

          entree: {
            quantite:
              quantiteEntree,

            type:
              typeEntreeNormalise,

            quantite_unites:
              quantiteUnites,

            multiplicateur:
              multiplicateur
          }
        });
      }

      /*
       * =====================================================
       * NOUVEL ARTICLE
       * =====================================================
       */

      const multiplicateurGros =
        Number(multiplicateur_gros);

      const multiplicateurDetail =
        Number(multiplicateur_detail);

      /*
       * Pour un nouvel article, les multiplicateurs doivent
       * être fournis correctement.
       */

      if (
        !Number.isFinite(multiplicateurGros) ||
        multiplicateurGros < 1
      ) {
        return res.status(400).json({
          message:
            'Le multiplicateur Gros est obligatoire pour un nouvel article.'
        });
      }

      if (
        !Number.isFinite(multiplicateurDetail) ||
        multiplicateurDetail < 1
      ) {
        return res.status(400).json({
          message:
            'Le multiplicateur Détail est obligatoire pour un nouvel article.'
        });
      }

      /*
        * =====================================================
        * VALIDATION DES PRIX SELON LE TYPE D'ENTRÉE
        * =====================================================
        *
        * À la PREMIÈRE enregistrement de l'article, tous les
        * prix applicables doivent être fournis :
        *
        * - Gros   : gros + détail + unité
        * - Détail : détail + unité
        * - Pièce  : unité uniquement
        */

      if (
        typeEntreeNormalise === 'Gros' &&
        (prixGrosSaisi === null || Number.isNaN(prixGrosSaisi))
      ) {
        return res.status(400).json({
          message:
            "Le prix de vente en gros est obligatoire pour un nouvel article entré en gros."
        });
      }

      if (
        (typeEntreeNormalise === 'Gros' ||
          typeEntreeNormalise === 'Détail') &&
        (prixDetailSaisi === null || Number.isNaN(prixDetailSaisi))
      ) {
        return res.status(400).json({
          message:
            "Le prix de vente à la détail est obligatoire pour un nouvel article."
        });
      }

      /*
        * Calcul du multiplicateur utilisé.
        */

      const multiplicateur =
        typeEntreeNormalise === 'Gros'
          ? multiplicateurGros
          : typeEntreeNormalise === 'Détail'
            ? multiplicateurDetail
            : 1;

      /*
       * Conversion de l'entrée en unités de base.
       */

      const quantiteUnites =
        quantiteEntree *
        multiplicateur;

      /*
       * Seuil.
       */

      const seuil =
        seuil_alerte !== undefined
          ? Number(seuil_alerte)
          : 5;

      if (
        !Number.isFinite(seuil) ||
        seuil < 0
      ) {
        return res.status(400).json({
          message:
            "Le seuil d'alerte est invalide."
        });
      }

      /*
       * =====================================================
       * CRÉATION DU STOCK
       * =====================================================
       */

      stock =
        new Stock({
          nom_article:
            String(nom_article).trim(),

          quantite:
            quantiteUnites,

          seuil_alerte:
            seuil,

          multiplicateur_gros:
            multiplicateurGros,

          multiplicateur_detail:
            multiplicateurDetail,

          prix_vente:
            prixVente,

          /*
            * Compatibilité ancienne structure.
            */

          prix_vente_unite:
            prixVente,

          prix_vente_detail:
            prixDetailSaisi || 0,

          prix_vente_gros:
            prixGrosSaisi || 0,

          site_id:
            targetSiteId
        });

      await stock.save();

      /*
       * =====================================================
       * CRÉATION DU MOUVEMENT
       * =====================================================
       */

      const mouvement =
        await StockMouvement.create({
          stock_id:
            stock._id,

          nom_article:
            stock.nom_article,

          type:
            'entree',

          type_entree:
            typeEntreeNormalise,

          quantite_entree:
            quantiteEntree,

          quantite_unites:
            quantiteUnites,

          multiplicateur_utilise:
            multiplicateur,

          prix_vente_unitaire:
            prixUnitaireCalcul,

          prix_total:
            prixTotal,

          seuil_alerte:
            seuil,

          user_id:
            userId,

          site_id:
            targetSiteId,

          description:
            'Création du stock'
        });

      /*
       * =====================================================
       * SOCKET
       * =====================================================
       */

      const io =
        req.app.get('io');

      if (io) {
        io.emit(
          'stock_mis_a_jour',
          stock
        );

        io.emit(
          'stock_mouvement_ajoute',
          mouvement
        );
      }

      /*
       * =====================================================
       * RÉPONSE
       * =====================================================
       */

      return res.status(201).json({
        message:
          'Stock enregistré avec succès.',

        stock,

        mouvement,

        entree: {
          quantite:
            quantiteEntree,

          type:
            typeEntreeNormalise,

          quantite_unites:
            quantiteUnites,

          multiplicateur:
            multiplicateur
        }
      });

    } catch (error) {
      console.error(
        'Erreur enregistrement stock :',
        error
      );

      /*
       * Gestion du doublon MongoDB
       */

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          message:
            'Cet article existe déjà sur ce site.'
        });
      }

      return res.status(500).json({
        message:
          "Erreur lors de l'enregistrement du stock.",

        error:
          error.message
      });
    }
  }
);

/*
 * =========================================================
 * POST /api/stocks/decoupage
 * =========================================================
 *
 * DÉCOUPAGE D'UN ARTICLE DU STOCK (BÂCHE / AUTOCOLLANT)
 *
 * 1. Décrémente l'article source de 1 dans le stock.
 * 2. Enregistre le mouvement de sortie de type "decoupage".
 * 3. Enregistre la mesure restante / chute dans le stock avec son prix de vente (si reste > 0).
 * 4. Enregistre une activité dans le journal pour traçabilité.
 */
router.post(
  '/decoupage',
  verifyToken,
  async (req, res) => {
    try {
      if (!peutFaireDecoupage(req)) {
        return res.status(403).json({
          message: "Accès refusé : la fonction de découpage est réservée au secrétariat de Difakpota."
        });
      }

      const {
        stock_id,
        mesure_totale,
        mesure_retiree,
        nom_article_chute,
        prix_vente_chute,
        description
      } = req.body;

      const userId = obtenirUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Utilisateur introuvable." });
      }

      const siteId = req.user?.site_id || req.user?.site?._id || req.body.site_id;
      if (!siteId) {
        return res.status(400).json({ message: "Site introuvable." });
      }

      if (!stock_id) {
        return res.status(400).json({ message: "Veuillez sélectionner un article à découper." });
      }

      const mTotale = parseFloat(String(mesure_totale).replace(',', '.'));
      const mRetiree = parseFloat(String(mesure_retiree).replace(',', '.'));

      if (isNaN(mTotale) || mTotale <= 0) {
        return res.status(400).json({ message: "La mesure totale initiale doit être supérieure à 0." });
      }

      if (isNaN(mRetiree) || mRetiree <= 0) {
        return res.status(400).json({ message: "La mesure retirée doit être supérieure à 0." });
      }

      if (mRetiree > mTotale) {
        return res.status(400).json({ message: "La mesure retirée ne peut pas dépasser la mesure totale." });
      }

      const mRestante = Number((mTotale - mRetiree).toFixed(2));

      // 1. Récupération de l'article source
      const stockSource = await Stock.findOne({
        id: stock_id,
        site_id: siteId
      });

      if (!stockSource) {
        return res.status(404).json({ message: "Article source introuvable dans le stock de votre agence." });
      }

      if (Number(stockSource.quantite) < 1) {
        return res.status(400).json({ message: `Stock insuffisant pour "${stockSource.nom_article}" (Quantité disponible: ${stockSource.quantite}).` });
      }

      // 2. Décrémenter l'article source de 1
      stockSource.quantite = Math.max(0, Number(stockSource.quantite) - 1);
      await stockSource.save();

      // 3. Mouvement de sortie découpage
      const mouvementSortie = await StockMouvement.create({
        stock_id: stockSource._id,
        nom_article: stockSource.nom_article,
        mouvement_type: 'decoupage',
        type: 'decoupage',
        type_entree: 'Pièce',
        quantite_entree: 1,
        quantite_unites: 1,
        prix_vente_unitaire: Number(stockSource.prix_vente_unite) || Number(stockSource.prix_vente) || 0,
        prix_total: 0,
        seuil_alerte: stockSource.seuil_alerte,
        user_id: userId,
        site_id: siteId,
        description: `Découpage : ${mRetiree}m retirés sur ${mTotale}m (Reste: ${mRestante}m). ${description ? description.trim() : ''}`.trim()
      });

      let nouveauStockChute = null;
      let mouvementEntreeChute = null;

      // 4. Si mesure restante > 0, enregistrer la chute dans le stock
      if (mRestante > 0) {
        const nomChute = String(nom_article_chute || `${stockSource.nom_article} - Reste ${mRestante}m`).trim();
        const pVenteChute = Number(prix_vente_chute) || 0;

        nouveauStockChute = new Stock({
          nom_article: nomChute,
          quantite: 1,
          seuil_alerte: 1,
          multiplicateur_gros: 1,
          multiplicateur_detail: 1,
          prix_vente: pVenteChute,
          prix_vente_unite: pVenteChute,
          prix_vente_detail: pVenteChute,
          prix_vente_gros: pVenteChute,
          site_id: siteId
        });
        await nouveauStockChute.save();

        mouvementEntreeChute = await StockMouvement.create({
          stock_id: nouveauStockChute._id,
          nom_article: nomChute,
          mouvement_type: 'entree',
          type: 'entree',
          type_entree: 'Pièce',
          quantite_entree: 1,
          quantite_unites: 1,
          prix_vente_unitaire: pVenteChute,
          prix_total: 0,
          seuil_alerte: 1,
          user_id: userId,
          site_id: siteId,
          description: `Chute issue du découpage de ${stockSource.nom_article} (${mRestante}m)`
        });
      }

      // 5. Enregistrer l'activité dans le journal
      const nomChuteDesc = nouveauStockChute ? nouveauStockChute.nom_article : `${stockSource.nom_article} (chute)`;
      const activite = new Activite({
        type: 'decoupage',
        designation: `Découpage : ${stockSource.nom_article}`,
        description: `${mRetiree}m découpés sur ${mTotale}m.` + (mRestante > 0 ? ` Reste enregistré : ${nomChuteDesc} (${mRestante}m à ${Number(prix_vente_chute).toLocaleString('fr-FR')} FCFA)` : ' Aucune chute restante.'),
        quantite: 1,
        quantite_unites: 1,
        prix_unitaire: 0,
        montant_total: 0,
        site_id: siteId,
        user_id: userId
      });
      await activite.save();

      // 6. Socket.io
      const io = req.app.get('io');
      if (io) {
        io.emit('stock_mis_a_jour', stockSource);
        if (nouveauStockChute) {
          io.emit('stock_mis_a_jour', nouveauStockChute);
        }
        io.emit('stock_mouvement_ajoute', mouvementSortie);
        if (mouvementEntreeChute) {
          io.emit('stock_mouvement_ajoute', mouvementEntreeChute);
        }
        io.emit('activite_ajoutee', activite);
      }

      return res.status(201).json({
        message: 'Découpage enregistré avec succès.',
        stock_source: stockSource,
        chute: nouveauStockChute,
        mesure_totale: mTotale,
        mesure_retiree: mRetiree,
        mesure_restante: mRestante,
        activite
      });
    } catch (error) {
      console.error('Erreur découpage stock :', error);
      return res.status(500).json({
        message: error.message || 'Erreur lors du découpage du stock.'
      });
    }
  }
);

module.exports = router;
