const { createModel } = require('../pgModel');

const customMethods = {
  calculerQuantiteEnPieces(quantiteDemandee, modeVente) {
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
      default:
        multiplicateur = 1;
        break;
    }
    return quantite * multiplicateur;
  },

  obtenirPrixParOption(modeVente) {
    switch (modeVente) {
      case 'Gros':
        return Number(this.prix_vente_gros) || 0;
      case 'Détail':
        return Number(this.prix_vente_detail) || 0;
      case 'Pièce':
      case 'Unité':
      case 'Unite':
      default:
        return Number(this.prix_vente_unite) || Number(this.prix_vente) || 0;
    }
  }
};

module.exports = createModel('stocks', customMethods);