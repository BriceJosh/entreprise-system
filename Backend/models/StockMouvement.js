const mongoose = require('mongoose');

const stockMouvementSchema = new mongoose.Schema(
  {
    /*
     * =========================================================
     * ARTICLE
     * =========================================================
     */

    stock_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock',
      required: [true, 'Le stock est obligatoire']
    },

    nom_article: {
      type: String,
      required: [true, "Le nom de l'article est obligatoire"],
      trim: true
    },

    /*
     * =========================================================
     * TYPE DE MOUVEMENT
     * =========================================================
     *
     * Pour le moment nous enregistrons principalement :
     *
     * entree
     *
     * Les mouvements de vente seront ajoutés à l'étape suivante.
     */

    type: {
      type: String,
      enum: ['entree', 'sortie', 'ajustement'],
      required: true,
      default: 'entree'
    },

    /*
     * =========================================================
     * TYPE D'ENTRÉE
     * =========================================================
     *
     * Ce que l'utilisateur a réellement saisi.
     */

    type_entree: {
      type: String,
      enum: ['Gros', 'Détail', 'Pièce'],
      required: function () {
        return this.type === 'entree';
      }
    },

    /*
     * =========================================================
     * QUANTITÉ SAISIE
     * =========================================================
     *
     * Exemple :
     *
     * type_entree = Gros
     * quantite_entree = 2
     *
     * signifie :
     *
     * 2 Gros
     */

    quantite_entree: {
      type: Number,
      min: [0, 'La quantité saisie ne peut pas être négative'],
      required: function () {
        return this.type === 'entree';
      }
    },

    /*
     * =========================================================
     * QUANTITÉ CONVERTIE
     * =========================================================
     *
     * C'est la quantité réellement ajoutée au stock.
     *
     * Exemple :
     *
     * 2 Gros × 100
     *
     * = 200 unités
     */

    quantite_unites: {
      type: Number,
      required: true,
      min: [0, 'La quantité en unités ne peut pas être négative']
    },

    /*
     * =========================================================
     * MULTIPLICATEUR UTILISÉ
     * =========================================================
     *
     * Permet de conserver l'information historique même si
     * les multiplicateurs du produit changent plus tard.
     */

    multiplicateur_utilise: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },

    /*
     * =========================================================
     * PRIX DE VENTE
     * =========================================================
     *
     * Prix de référence du produit au moment de l'entrée.
     */

    prix_vente_unitaire: {
      type: Number,
      default: 0,
      min: [0, 'Le prix de vente ne peut pas être négatif']
    },

    /*
     * =========================================================
     * PRIX TOTAL DU STOCK ENTRANT
     * =========================================================
     *
     * Exemple :
     *
     * 2 Gros
     * coût total = 250 000 FCFA
     */

    prix_total: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Le prix total ne peut pas être négatif']
    },

    /*
     * =========================================================
     * SEUIL AU MOMENT DE L'ENREGISTREMENT
     * =========================================================
     */

    seuil_alerte: {
      type: Number,
      default: 5,
      min: 0
    },

    /*
     * =========================================================
     * UTILISATEUR
     * =========================================================
     */

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'utilisateur est obligatoire"]
    },

    /*
     * =========================================================
     * SITE
     * =========================================================
     */

    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Le site est obligatoire']
    },

    /*
     * =========================================================
     * NOTE
     * =========================================================
     */

    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

/*
 * =========================================================
 * INDEX
 * =========================================================
 */

stockMouvementSchema.index({
  site_id: 1,
  createdAt: -1
});

stockMouvementSchema.index({
  stock_id: 1,
  createdAt: -1
});

stockMouvementSchema.index({
  user_id: 1,
  createdAt: -1
});

stockMouvementSchema.index({
  type: 1,
  createdAt: -1
});

module.exports = mongoose.model(
  'StockMouvement',
  stockMouvementSchema
);