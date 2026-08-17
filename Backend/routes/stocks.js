const express = require('express');
const router = express.Router();

const Stock = require('../models/Stock');
const StockMouvement = require('../models/StockMouvement');

const {
  verifyToken
} = require('../middleware/authMiddleware');

const {
  peutLireStock,
  peutGererArticleStock
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
       * PRIX
       * =====================================================
       */

      const prixVente =
        Number.isFinite(Number(prix_vente))
          ? Number(prix_vente)
          : Number(prix_vente_unite) || 0;

      const prixTotal =
        Number(prix_total);

      if (
        !Number.isFinite(prixTotal) ||
        prixTotal < 0
      ) {
        return res.status(400).json({
          message:
            'Le prix total est invalide.'
        });
      }

      if (
        !Number.isFinite(prixVente) ||
        prixVente < 0
      ) {
        return res.status(400).json({
          message:
            'Le prix de vente est invalide.'
        });
      }

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
         * Le nouveau prix de vente devient le prix
         * de référence actuel.
         */

        stock.prix_vente =
          prixVente;

        /*
         * Compatibilité avec l'ancien système.
         *
         * On garde également le prix unité.
         */

        stock.prix_vente_unite =
          prixVente;

        /*
         * Si l'ancien frontend envoyait encore des prix
         * Gros/Détail, on les conserve.
         */

        if (
          prix_vente_detail !== undefined
        ) {
          stock.prix_vente_detail =
            Number(prix_vente_detail) || 0;
        }

        if (
          prix_vente_gros !== undefined
        ) {
          stock.prix_vente_gros =
            Number(prix_vente_gros) || 0;
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
              prixVente,

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
            Number(prix_vente_detail) || 0,

          prix_vente_gros:
            Number(prix_vente_gros) || 0,

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
            prixVente,

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

module.exports = router;
