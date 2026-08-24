const mongoose = require('mongoose');

const activiteSchema = new mongoose.Schema(
  {
    /*
     * =========================================================
     * TYPE D'ACTIVITÉ
     * =========================================================
     */

    type: {
      type: String,
      enum: {
        values: ['impression', 'vente', 'depense'],
        message: "{VALUE} n'est pas un type d'activité valide"
      },
      required: [true, "Le type d'activité est requis"]
    },

    /*
     * =========================================================
     * DÉSIGNATION
     * =========================================================
     */

    designation: {
      type: String,
      trim: true,
      required: function () {
        return this.type !== 'depense';
      }
    },

    /*
     * =========================================================
     * DESCRIPTION
     * =========================================================
     */

    description: {
      type: String,
      trim: true,
      default: ''
    },

    /*
     * =========================================================
     * QUANTITÉ SAISIE PAR L'UTILISATEUR
     *
     * Exemple :
     *
     * 2 Gros
     * 5 Détail
     * 3 Pièce
     *
     * Cette valeur représente toujours la quantité
     * dans le mode de vente choisi.
     * =========================================================
     */

    quantite: {
      type: Number,
      default: 1,
      min: [1, "La quantité doit être d'au moins 1"]
    },

    /*
     * =========================================================
     * QUANTITÉ RÉELLE EN UNITÉS DE BASE
     *
     * Exemple :
     *
     * 2 Gros × 1000 = 2000 unités
     * 5 Détail × 50 = 250 unités
     * 3 Pièce × 1 = 3 unités
     *
     * Cette valeur sert notamment à garder une trace exacte
     * de ce qui a été retiré du stock.
     * =========================================================
     */

    quantite_unites: {
      type: Number,
      default: 1,
      min: [1, "La quantité en unités doit être d'au moins 1"]
    },

    /*
     * =========================================================
     * PRIX UNITAIRE DE VENTE
     *
     * Attention :
     * "unitaire" signifie ici le prix d'une unité du mode
     * choisi par le client.
     *
     * Exemple :
     *
     * 1 Gros = 15 000 FCFA
     * 1 Détail = 900 FCFA
     * 1 Pièce = 20 FCFA
     * =========================================================
     */

    prix_unitaire: {
      type: Number,
      min: [0, 'Le prix unitaire ne peut pas être négatif'],
      default: 0
    },

    /*
     * =========================================================
     * MONTANT TOTAL
     *
     * Vente :
     * quantité saisie × prix du mode de vente
     *
     * Exemple :
     * 2 Gros × 15 000 = 30 000 FCFA
     *
     * IMPORTANT :
     * On ne multiplie PAS quantite_unites par prix_unitaire,
     * car le prix_unitaire correspond au mode de vente.
     * =========================================================
     */

    montant_total: {
      type: Number,
      min: [0, 'Le montant total ne peut pas être négatif'],
      default: 0
    },

    /*
     * =========================================================
     * OPTION DE VENTE
     * =========================================================
     *
     * Pièce  = unité de base
     * Détail = conditionnement intermédiaire
     * Gros   = conditionnement supérieur
     *
     * Obligatoire uniquement pour les ventes.
     * =========================================================
     */

    option_vente: {
      type: String,
      enum: {
        values: ['Détail', 'Gros', 'Pièce'],
        message: "{VALUE} n'est pas une option de vente valide"
      },
      required: function () {
        return this.type === 'vente';
      }
    },

    /*
     * =========================================================
     * REÇU ASSOCIÉ (facultatif)
     * =========================================================
     *
     * Si la vente fait partie d'un reçu client.
     */

    recu_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recu',
      default: null
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
     * UTILISATEUR
     * =========================================================
     */

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "L'utilisateur est obligatoire"]
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

activiteSchema.index({
  site_id: 1,
  createdAt: -1
});

activiteSchema.index({
  user_id: 1,
  createdAt: -1
});

activiteSchema.index({
  type: 1,
  site_id: 1
});

activiteSchema.index({
  type: 1,
  createdAt: -1
});

/*
 * =========================================================
 * CALCUL AUTOMATIQUE DU MONTANT TOTAL
 * =========================================================
 *
 * Pour une vente :
 *
 * quantité saisie × prix du mode de vente
 *
 * Exemple :
 *
 * 2 Gros × 15 000 = 30 000
 *
 * Pour une impression :
 *
 * quantité × prix unitaire
 *
 * Pour une dépense :
 * le montant est conservé tel quel.
 * =========================================================
 */

activiteSchema.pre('save', function () {
  if (this.type !== 'depense') {
    const qte = Number(this.quantite) || 0;
    const prix = Number(this.prix_unitaire) || 0;

    this.montant_total = qte * prix;
  }
});

/*
 * =========================================================
 * NORMALISATION / SÉCURITÉ
 * =========================================================
 */

activiteSchema.pre('validate', function () {
  if (this.type === 'vente') {
    if (!this.option_vente) {
      throw new Error("L'option de vente est obligatoire pour une vente.");
    }

    if (!Number.isFinite(Number(this.quantite)) || Number(this.quantite) <= 0) {
      throw new Error('La quantité vendue doit être supérieure à 0.');
    }

    if (
      !Number.isFinite(Number(this.quantite_unites)) ||
      Number(this.quantite_unites) <= 0
    ) {
      throw new Error(
        'La quantité réelle en unités doit être supérieure à 0.'
      );
    }
  }
});

module.exports = mongoose.model('Activite', activiteSchema);