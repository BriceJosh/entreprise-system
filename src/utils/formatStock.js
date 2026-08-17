/**
 * =========================================================
 * FORMATAGE DU STOCK POUR L'AFFICHAGE
 * =========================================================
 *
 * IMPORTANT :
 * ---------------------------------------------------------
 * La quantité reçue ici est toujours la quantité réelle
 * enregistrée dans le stock, c'est-à-dire en unités de base.
 *
 * Exemple :
 *
 * quantite = 225
 * multiplicateur_gros = 100
 * multiplicateur_detail = 10
 *
 * Affichage :
 *
 * 2 Gros · 2 Détail · 5 Pièces
 *
 * Cette fonction NE MODIFIE JAMAIS la quantité du stock.
 * Elle sert uniquement à la présenter de manière humaine.
 * =========================================================
 */

export function formaterStock(stock) {
  if (!stock) {
    return '0 Pièce';
  }

  let quantite = Number(stock.quantite);

  if (!Number.isFinite(quantite) || quantite < 0) {
    quantite = 0;
  }

  /*
   * =======================================================
   * MULTIPLICATEURS
   * =======================================================
   *
   * Pièce = 1 unité de base
   *
   * Exemple :
   * 1 Détail = 10 pièces
   * 1 Gros = 100 pièces
   */

  const gros = Number(stock.multiplicateur_gros);

  const detail = Number(stock.multiplicateur_detail);

  const multiplicateurGros =
    Number.isFinite(gros) && gros > 1
      ? gros
      : 1;

  const multiplicateurDetail =
    Number.isFinite(detail) && detail > 1
      ? detail
      : 1;

  const morceaux = [];

  /*
   * =======================================================
   * GROS
   * =======================================================
   */

  if (multiplicateurGros > 1) {
    const nombreGros = Math.floor(
      quantite / multiplicateurGros
    );

    if (nombreGros > 0) {
      morceaux.push(
        `${nombreGros} Gros`
      );

      quantite -=
        nombreGros * multiplicateurGros;
    }
  }

  /*
   * =======================================================
   * DÉTAIL
   * =======================================================
   */

  if (multiplicateurDetail > 1) {
    const nombreDetail = Math.floor(
      quantite / multiplicateurDetail
    );

    if (nombreDetail > 0) {
      morceaux.push(
        `${nombreDetail} Détail`
      );

      quantite -=
        nombreDetail * multiplicateurDetail;
    }
  }

  /*
   * =======================================================
   * PIÈCES RESTANTES
   * =======================================================
   */

  const nombrePieces = Math.floor(quantite);

  if (nombrePieces > 0) {
    morceaux.push(
      `${nombrePieces} Pièce${nombrePieces > 1 ? 's' : ''}`
    );
  }

  /*
   * =======================================================
   * STOCK VIDE
   * =======================================================
   */

  if (morceaux.length === 0) {
    return '0 Pièce';
  }

  /*
   * =======================================================
   * AFFICHAGE FINAL
   * =======================================================
   */

  return morceaux.join(' · ');
}

/**
 * Formate la quantité telle qu'elle a été vendue. Contrairement à
 * formaterStock, cette fonction ne convertit rien : une activité conserve
 * déjà sa quantité dans le mode choisi par la secrétaire.
 */
export function formaterQuantiteVente(quantite, optionVente) {
  const nombre = Number(quantite);
  const quantitePropre =
    Number.isFinite(nombre) && nombre > 0
      ? nombre
      : 0;

  const mode = String(optionVente || 'Pièce')
    .trim()
    .toLowerCase();

  if (mode === 'gros') {
    return `${quantitePropre} Gros`;
  }

  if (mode === 'détail' || mode === 'detail') {
    return `${quantitePropre} Détail${
      quantitePropre > 1 ? 's' : ''
    }`;
  }

  return `${quantitePropre} Pièce${
    quantitePropre > 1 ? 's' : ''
  }`;
}
