const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema(
  {
    /*
     * =========================================================
     * ARTICLE
     * =========================================================
     */

    nom_article: {
      type: String,
      required: [true, "Le nom de l'article est obligatoire"],
      trim: true
    },

    /*
     * =========================================================
     * QUANTITÉ CENTRALE
     * =========================================================
     *
     * IMPORTANT :
     * La quantité est TOUJOURS enregistrée dans la plus petite
     * unité vendable.
     *
     * Exemple :
     * 1 gros = 100 unités
     * 1 détail = 10 unités
     *
     * Si on entre 2 gros :
     * quantite = 200
     */

    quantite: {
      type: Number,
      required: [true, 'La quantité est obligatoire'],
      default: 0,
      min: [0, 'La quantité ne peut pas être négative']
    },

    /*
     * =========================================================
     * SEUIL D'ALERTE
     * =========================================================
     *
     * Toujours exprimé dans l'unité de base.
     */

    seuil_alerte: {
      type: Number,
      default: 5,
      min: [0, "Le seuil d'alerte ne peut pas être négatif"]
    },

    /*
     * =========================================================
     * MULTIPLICATEURS
     * =========================================================
     *
     * Pièce = toujours 1
     *
     * Exemple :
     * 1 détail = 10 unités
     * 1 gros = 100 unités
     */

    multiplicateur_detail: {
      type: Number,
      default: 1,
      min: [1, 'Le multiplicateur détail doit être au moins égal à 1']
    },

    multiplicateur_gros: {
      type: Number,
      default: 1,
      min: [1, 'Le multiplicateur gros doit être au moins égal à 1']
    },

    /*
     * =========================================================
     * PRIX DE VENTE DE BASE
     * =========================================================
     *
     * Pour cette nouvelle logique, on conserve un prix de vente
     * de référence exprimé pour UNE unité de base.
     *
     * Exemple :
     * 1 stylo = 500 FCFA
     *
     * Les prix spécifiques Gros/Détail seront gérés plus tard
     * dans la logique de vente.
     */

    prix_vente: {
      type: Number,
      default: 0,
      min: [0, 'Le prix de vente ne peut pas être négatif']
    },

    /*
     * =========================================================
     * COMPATIBILITÉ AVEC L'ANCIEN SYSTÈME
     * =========================================================
     *
     * On les conserve temporairement pour ne pas casser les
     * anciennes données et les anciennes ventes.
     *
     * Ils seront nettoyés à l'étape "VENTE".
     */

    prix_vente_unite: {
      type: Number,
      default: 0,
      min: [0, 'Le prix ne peut pas être négatif']
    },

    prix_vente_detail: {
      type: Number,
      default: 0,
      min: [0, 'Le prix ne peut pas être négatif']
    },

    prix_vente_gros: {
      type: Number,
      default: 0,
      min: [0, 'Le prix ne peut pas être négatif']
    },

    /*
     * =========================================================
     * SITE
     * =========================================================
     */

    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: [true, 'Le site rattaché est obligatoire']
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

stockSchema.index(
  {
    site_id: 1,
    nom_article: 1
  },
  {
    unique: true
  }
);

stockSchema.index({
  site_id: 1,
  quantite: 1
});

/*
 * =========================================================
 * MÉTHODE :
 * CONVERSION VERS L'UNITÉ DE BASE
 * =========================================================
 */

// =========================================================
// CONVERSION D'UNE VENTE EN UNITÉS DE BASE
// =========================================================

stockSchema.methods.calculerQuantiteEnPieces = function (
  quantiteDemandee,
  modeVente
) {
  const quantite = Number(quantiteDemandee);

  if (!Number.isFinite(quantite) || quantite <= 0) {
    throw new Error('La quantité demandée est invalide.');
  }

  let multiplicateur = 1;

  switch (modeVente) {
    case 'Gros':
      multiplicateur = Number(this.multiplicateur_gros) || 1;
      break;

    case 'Détail':
      multiplicateur = Number(this.multiplicateur_detail) || 1;
      break;

    case 'Pièce':
    case 'Unité':
    case 'Unite':
      multiplicateur = 1;
      break;

    default:
      throw new Error(`Mode de vente invalide : ${modeVente}`);
  }

  return quantite * multiplicateur;
};

/*
 * =========================================================
 * MÉTHODE :
 * OBTENIR LE STOCK SOUS FORME HUMAINE
 * =========================================================
 *
 * Exemple :
 *
 * quantite = 253
 * gros = 100
 * detail = 10
 *
 * résultat :
 *
 * {
 *   gros: 2,
 *   detail: 5,
 *   unite: 3
 * }
 */

// =========================================================
// PRIX SELON LE MODE DE VENTE
// =========================================================

stockSchema.methods.obtenirPrixParOption = function (modeVente) {
  switch (modeVente) {
    case 'Gros':
      return Number(this.prix_vente_gros) || 0;

    case 'Détail':
      return Number(this.prix_vente_detail) || 0;

    case 'Pièce':
    case 'Unité':
    case 'Unite':
      return Number(this.prix_vente_unite) || 0;

    default:
      return 0;
  }
};
/*
 * =========================================================
 * VIRTUAL :
 * AFFICHAGE HUMAIN DU STOCK
 * =========================================================
 */

stockSchema.virtual('stock_formate').get(function () {
  let reste = Number(this.quantite) || 0;

  const gros = this.multiplicateur_gros || 1;
  const detail = this.multiplicateur_detail || 1;

  const quantiteGros =
    gros > 1
      ? Math.floor(reste / gros)
      : 0;

  reste -= quantiteGros * gros;

  const quantiteDetail =
    detail > 1
      ? Math.floor(reste / detail)
      : 0;

  reste -= quantiteDetail * detail;

  return {
    gros: quantiteGros,
    detail: quantiteDetail,
    unite: reste,

    texte: [
      quantiteGros > 0
        ? `${quantiteGros} Gros`
        : null,

      quantiteDetail > 0
        ? `${quantiteDetail} Détail`
        : null,

      reste > 0
        ? `${reste} Unité${reste > 1 ? 's' : ''}`
        : null
    ]
      .filter(Boolean)
      .join(' • ') || '0 Unité'
  };
});

/*
 * =========================================================
 * JSON / OBJECT
 * =========================================================
 */

stockSchema.set('toJSON', {
  virtuals: true
});

stockSchema.set('toObject', {
  virtuals: true
});

module.exports = mongoose.model('Stock', stockSchema);