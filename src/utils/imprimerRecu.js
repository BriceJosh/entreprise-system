/*
 * =========================================================
 * IMPRESSION D'UN REÇU CLIENT
 * =========================================================
 *
 * Ouvre une fenêtre avec le reçu formaté (format ticket
 * 80mm) et lance l'impression via le navigateur.
 * =========================================================
 */

export function imprimerRecu(recu, infosEntreprise = {}) {
  const lignesHtml = (recu.lignes || [])
    .map(
      (ligne) => `
        <tr>
          <td>${escapeHtml(ligne.designation)}</td>
          <td class="center">${ligne.quantite} ${escapeHtml(ligne.option_vente)}</td>
          <td class="right">${formatFcfa(ligne.prix_unitaire)}</td>
          <td class="right">${formatFcfa(ligne.montant)}</td>
        </tr>`,
    )
    .join("");

  const nomEntreprise =
    infosEntreprise.nom || "ESPACE COMMERCIAL LE ROCHER";

  const telephoneSite = formaterTelephone(
    recu.site_telephone || recu.site_id?.telephone,
  );

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Reçu ${recu.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      margin: 0 auto;
      padding: 6px;
      color: #000;
      font-size: 12px;
    }
    h1 { font-size: 16px; text-align: center; letter-spacing: 1px; }
    .sous-titre { text-align: center; font-size: 10px; margin-bottom: 8px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
    td { padding: 3px 0; vertical-align: top; }
    .center { text-align: center; }
    .right { text-align: right; white-space: nowrap; }
    .total {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: bold;
      margin-top: 4px;
    }
    .footer { text-align: center; font-size: 10px; margin-top: 8px; }
    @media print {
      @page { margin: 5mm; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(nomEntreprise)}</h1>

  <p class="sous-titre">
    ${(recu.site_nom || recu.site_id?.nom) ? escapeHtml(recu.site_nom || recu.site_id.nom) + "<br/>" : ""}
    ${telephoneSite ? "Tél : " + escapeHtml(telephoneSite) + "<br/>" : ""}
    Reçu N° ${escapeHtml(recu.numero)}<br/>
    ${new Date(recu.createdAt).toLocaleString("fr-FR")}<br/>
    Servi par : ${escapeHtml(recu.servi_par?.trim() || recu.user_id?.username || "-")}
    ${recu.nom_client ? "<br/>Client : " + escapeHtml(recu.nom_client) : ""}
  </p>

  <div class="sep"></div>

  <table>
    <thead>
      <tr>
        <th>Article</th>
        <th class="center">Qté</th>
        <th class="right">P.U.</th>
        <th class="right">Montant</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  <div class="sep"></div>

  <div class="total">
    <span>TOTAL</span>
    <span>${formatFcfa(recu.montant_total)}</span>
  </div>

  ${
    recu.montant_paye != null
      ? `<div class="total" style="font-size:12px">
           <span>Payé</span>
           <span>${formatFcfa(recu.montant_paye)}</span>
         </div>
         <div class="total" style="font-size:12px">
           <span>Monnaie</span>
           <span>${formatFcfa(recu.monnaie_rendue ?? 0)}</span>
         </div>`
      : ""
  }

  <div class="sep"></div>

  <p class="footer">Merci de votre confiance !</p>

  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const fenetre = window.open("", "_blank", "width=420,height=650");

  if (!fenetre) {
    alert(
      "Impossible d'ouvrir la fenêtre d'impression. Veuillez autoriser les pop-ups pour ce site.",
    );

    return;
  }

  fenetre.document.write(html);
  fenetre.document.close();
}

/*
 * =========================================================
 * UTILITAIRES
 * =========================================================
 */

function formatFcfa(montant) {
  return `${Number(montant || 0).toLocaleString("fr-FR")} F`;
}

function formaterTelephone(numero) {
  const chiffres = String(numero ?? "").replace(/\D/g, "");

  // Numéros à 8 chiffres (Togo) : affichage par paires -> 93 87 07 04
  if (chiffres.length === 8) {
    return chiffres.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }

  return String(numero ?? "").trim();
}

function escapeHtml(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
