const express = require('express');
const router = express.Router();

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');

const Activite = require('../models/Activite');

const {
  verifyToken: authMiddleware
} = require('../middleware/authMiddleware');

/**
 * =========================================================
 * VÉRIFIER LES DROITS
 * =========================================================
 */

function verifierDirection(req, res) {

  const role =
    req.user?.role ||
    req.user?.profil?.role;

  if (
    role !== 'directeur' &&
    role !== 'admin'
  ) {
    res.status(403).json({
      message:
        'Accès réservé à la direction.'
    });

    return false;
  }

  return true;
}

/**
 * =========================================================
 * RÉCUPÉRER LES ACTIVITÉS
 * =========================================================
 *
 * Types :
 *
 * vente
 * impression
 * depense
 * =========================================================
 */

async function getActivitesData(
  user_id,
  date,
  site_id
) {

  const targetDate = date
    ? new Date(`${date}T00:00:00`)
    : new Date();

  if (
    Number.isNaN(
      targetDate.getTime()
    )
  ) {
    throw new Error(
      'Date invalide.'
    );
  }

  const startOfDay =
    new Date(targetDate);

  startOfDay.setHours(
    0,
    0,
    0,
    0
  );

  const endOfDay =
    new Date(targetDate);

  endOfDay.setHours(
    23,
    59,
    59,
    999
  );

  const filtre = {

    type: {
      $in: [
        'vente',
        'impression',
        'depense'
      ]
    },

    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay
    }

  };

  if (
    site_id &&
    site_id !== 'TOUS' &&
    site_id !== 'tous' &&
    site_id !== 'null' &&
    site_id !== 'undefined'
  ) {
    filtre.site_id = site_id;
  }

  if (
    user_id &&
    user_id !== 'TOUS' &&
    user_id !== 'tous' &&
    user_id !== 'null' &&
    user_id !== 'undefined'
  ) {
    filtre.user_id = user_id;
  }

  const activites =
    await Activite.find(filtre)
      .populate(
        'user_id',
        'username email role nom'
      )
      .populate(
        'site_id',
        'nom ville'
      )
      .sort({
        createdAt: 1
      })
      .lean();

  return activites;
}

/**
 * =========================================================
 * EXPORT EXCEL
 *
 * GET /api/caisse/export/excel
 * =========================================================
 */

router.get(
  '/export/excel',
  authMiddleware,
  async (req, res) => {

    try {

      if (
        !verifierDirection(
          req,
          res
        )
      ) {
        return;
      }

      const {
        site_id,
        user_id,
        secretaire_id,
        date
      } = req.query;

      const activites =
        await getActivitesData(
          user_id || secretaire_id,
          date,
          site_id
        );

      /*
       * =====================================================
       * CALCULS
       * =====================================================
       */

      let totalVentes = 0;
      let totalServices = 0;
      let totalDepenses = 0;

      activites.forEach(
        (activite) => {

          const montant =
            Number(
              activite.montant_total
            ) || 0;

          if (
            activite.type ===
            'vente'
          ) {
            totalVentes += montant;
          }

          else if (
            activite.type ===
            'impression'
          ) {
            totalServices += montant;
          }

          else if (
            activite.type ===
            'depense'
          ) {
            totalDepenses += montant;
          }
        }
      );

      const totalEntrees =
        totalVentes +
        totalServices;

      const soldeNet =
        totalEntrees -
        totalDepenses;

      /*
       * =====================================================
       * WORKBOOK
       * =====================================================
       */

      const workbook =
        new ExcelJS.Workbook();

      const worksheet =
        workbook.addWorksheet(
          'Supervision'
        );

      /*
       * =====================================================
       * TITRE
       * =====================================================
       */

      worksheet.mergeCells(
        'A1:I1'
      );

      const titre =
        worksheet.getCell('A1');

      titre.value =
        'RAPPORT DE SUPERVISION DES CAISSES';

      titre.font = {
        bold: true,
        size: 16
      };

      titre.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };

      worksheet.getRow(1).height = 28;

      /*
       * =====================================================
       * DATE
       * =====================================================
       */

      worksheet.mergeCells(
        'A2:I2'
      );

      const dateCell =
        worksheet.getCell('A2');

      dateCell.value =
        `Date : ${
          date ||
          new Date()
            .toISOString()
            .split('T')[0]
        }`;

      dateCell.alignment = {
        horizontal: 'center'
      };

      dateCell.font = {
        italic: true,
        size: 10
      };

      /*
       * =====================================================
       * EN-TÊTES
       * =====================================================
       */

      worksheet.addRow([]);

      const headerRow =
        worksheet.addRow([
          'Heure',
          'Type',
          'Agent',
          'Site',
          'Désignation',
          'Quantité',
          'Unité',
          'Prix unitaire',
          'Montant'
        ]);

      headerRow.font = {
        bold: true,
        color: {
          argb: 'FFFFFF'
        }
      };

      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: '059669'
        }
      };

      headerRow.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      };

      /*
       * =====================================================
       * COLONNES
       * =====================================================
       */

      worksheet.columns = [
        {
          key: 'heure',
          width: 12
        },
        {
          key: 'type',
          width: 15
        },
        {
          key: 'agent',
          width: 25
        },
        {
          key: 'site',
          width: 22
        },
        {
          key: 'designation',
          width: 32
        },
        {
          key: 'quantite',
          width: 12
        },
        {
          key: 'option',
          width: 18
        },
        {
          key: 'prix_unitaire',
          width: 18
        },
        {
          key: 'montant',
          width: 20
        }
      ];

      /*
       * =====================================================
       * DONNÉES
       * =====================================================
       */

      activites.forEach(
        (activite) => {

          const montant =
            Number(
              activite.montant_total
            ) || 0;

          const heure =
            activite.createdAt
              ? new Date(
                  activite.createdAt
                ).toLocaleTimeString(
                  'fr-FR',
                  {
                    hour: '2-digit',
                    minute: '2-digit'
                  }
                )
              : '-';

          let typeLabel =
            'Autre';

          if (
            activite.type ===
            'vente'
          ) {
            typeLabel =
              'Vente';
          }

          else if (
            activite.type ===
            'impression'
          ) {
            typeLabel =
              'Service';
          }

          else if (
            activite.type ===
            'depense'
          ) {
            typeLabel =
              'Dépense';
          }

          worksheet.addRow({

            heure,

            type: typeLabel,

            agent:
              activite.user_id?.username ||
              activite.user_id?.nom ||
              'N/A',

            site:
              activite.site_id?.nom ||
              'Site principal',

            designation:
              activite.designation ||
              activite.description ||
              'Opération',

            quantite:
              Number(
                activite.quantite
              ) || 1,

            option:
              activite.option_vente ||
              '-',

            prix_unitaire:
              Number(
                activite.prix_unitaire
              ) || 0,

            montant:
              activite.type ===
              'depense'
                ? -montant
                : montant

          });
        }
      );

      /*
       * =====================================================
       * FORMAT MONÉTAIRE
       * =====================================================
       */

      worksheet.eachRow(
        (row, rowNumber) => {

          if (
            rowNumber > 4
          ) {

            row.getCell(8)
              .numFmt =
              '#,##0 "FCFA"';

            row.getCell(9)
              .numFmt =
              '#,##0 "FCFA"';

          }

        }
      );

      /*
       * =====================================================
       * RÉSUMÉ
       * =====================================================
       */

      worksheet.addRow([]);

      const resumeTitle =
        worksheet.addRow([
          'RÉSUMÉ FINANCIER'
        ]);

      resumeTitle.font = {
        bold: true,
        size: 12
      };

      worksheet.addRow([
        'Total ventes',
        totalVentes
      ]);

      worksheet.addRow([
        'Total services',
        totalServices
      ]);

      worksheet.addRow([
        'Total entrées',
        totalEntrees
      ]);

      worksheet.addRow([
        'Total dépenses',
        -totalDepenses
      ]);

      const soldeRow =
        worksheet.addRow([
          'SOLDE NET',
          soldeNet
        ]);

      soldeRow.font = {
        bold: true
      };

      /*
       * =====================================================
       * FORMAT RÉSUMÉ
       * =====================================================
       */

      worksheet.eachRow(
        (row) => {

          if (
            row.getCell(1)
              .value ===
              'Total ventes' ||
            row.getCell(1)
              .value ===
              'Total services' ||
            row.getCell(1)
              .value ===
              'Total entrées' ||
            row.getCell(1)
              .value ===
              'Total dépenses' ||
            row.getCell(1)
              .value ===
              'SOLDE NET'
          ) {

            row.getCell(2)
              .numFmt =
              '#,##0 "FCFA"';

          }

        }
      );

      /*
       * =====================================================
       * BORDURES
       * =====================================================
       */

      worksheet.eachRow(
        (row, rowNumber) => {

          if (
            rowNumber >= 4
          ) {

            row.eachCell(
              (cell) => {

                cell.border = {
                  top: {
                    style: 'thin',
                    color: {
                      argb: 'D1D5DB'
                    }
                  },

                  bottom: {
                    style: 'thin',
                    color: {
                      argb: 'D1D5DB'
                    }
                  },

                  left: {
                    style: 'thin',
                    color: {
                      argb: 'D1D5DB'
                    }
                  },

                  right: {
                    style: 'thin',
                    color: {
                      argb: 'D1D5DB'
                    }
                  }
                };

              }
            );
          }

        }
      );

      /*
       * =====================================================
       * TÉLÉCHARGEMENT
       * =====================================================
       */

      const nomFichier =
        `Rapport_Supervision_${
          date || 'Journee'
        }.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nomFichier}"`
      );

      await workbook.xlsx.write(
        res
      );

      res.end();

    } catch (error) {

      console.error(
        'Erreur export Excel :',
        error
      );

      if (
        !res.headersSent
      ) {
        res.status(500).json({
          message:
            'Erreur lors de la génération du fichier Excel.',

          error:
            process.env.NODE_ENV ===
            'development'
              ? error.message
              : undefined
        });
      }

    }
  }
);

/**
 * =========================================================
 * EXPORT PDF
 *
 * GET /api/caisse/export/pdf
 * =========================================================
 */

router.get(
  '/export/pdf',
  authMiddleware,
  async (req, res) => {

    try {

      if (
        !verifierDirection(
          req,
          res
        )
      ) {
        return;
      }

      const {
        site_id,
        user_id,
        secretaire_id,
        date
      } = req.query;

      const activites =
        await getActivitesData(
          user_id || secretaire_id,
          date,
          site_id
        );

      /*
       * =====================================================
       * CALCULS
       * =====================================================
       */

      let totalVentes = 0;
      let totalServices = 0;
      let totalDepenses = 0;

      activites.forEach(
        (activite) => {

          const montant =
            Number(
              activite.montant_total
            ) || 0;

          if (
            activite.type ===
            'vente'
          ) {
            totalVentes += montant;
          }

          else if (
            activite.type ===
            'impression'
          ) {
            totalServices += montant;
          }

          else if (
            activite.type ===
            'depense'
          ) {
            totalDepenses += montant;
          }
        }
      );

      const totalEntrees =
        totalVentes +
        totalServices;

      const soldeNet =
        totalEntrees -
        totalDepenses;

      /*
       * =====================================================
       * DOCUMENT
       * =====================================================
       */

      const doc =
        new PDFDocument({
          margin: 30,
          size: 'A4',
          layout: 'landscape'
        });

      res.setHeader(
        'Content-Type',
        'application/pdf'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Rapport_Supervision_${
          date || 'Journee'
        }.pdf"`
      );

      doc.pipe(res);

      /*
       * =====================================================
       * TITRE
       * =====================================================
       */

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(
          'RAPPORT DE SUPERVISION DES CAISSES',
          {
            align: 'center'
          }
        );

      doc.moveDown(0.5);

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(
          `Date : ${
            date ||
            new Date()
              .toISOString()
              .split('T')[0]
          }`,
          {
            align: 'center'
          }
        );

      doc.moveDown(1);

      /*
       * =====================================================
       * TABLEAU
       * =====================================================
       */

      const rows =
        activites.map(
          (activite) => {

            const heure =
              activite.createdAt
                ? new Date(
                    activite.createdAt
                  ).toLocaleTimeString(
                    'fr-FR',
                    {
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )
                : '-';

            let typeLabel =
              'Autre';

            if (
              activite.type ===
              'vente'
            ) {
              typeLabel =
                'Vente';
            }

            else if (
              activite.type ===
              'impression'
            ) {
              typeLabel =
                'Service';
            }

            else if (
              activite.type ===
              'depense'
            ) {
              typeLabel =
                'Dépense';
            }

            const montant =
              Number(
                activite.montant_total
              ) || 0;

            const montantAffiche =
              activite.type ===
              'depense'
                ? `- ${montant.toLocaleString('fr-FR')} F`
                : `${montant.toLocaleString('fr-FR')} F`;

            return [

              heure,

              typeLabel,

              activite.user_id?.username ||
              activite.user_id?.nom ||
              'N/A',

              activite.site_id?.nom ||
              'Site principal',

              activite.designation ||
              activite.description ||
              'Opération',

              String(
                Number(
                  activite.quantite
                ) || 1
              ),

              activite.option_vente ||
              '-',

              `${
                (
                  Number(
                    activite.prix_unitaire
                  ) || 0
                ).toLocaleString(
                  'fr-FR'
                )
              } F`,

              montantAffiche

            ];
          }
        );

      const table = {

        title:
          'Détail des opérations',

        headers: [
          'Heure',
          'Type',
          'Agent',
          'Site',
          'Désignation',
          'Qté',
          'Unité',
          'Prix unitaire',
          'Montant'
        ],

        rows

      };

      await doc.table(
        table,
        {

          prepareHeader: () =>
            doc
              .font('Helvetica-Bold')
              .fontSize(7),

          prepareRow: () =>
            doc
              .font('Helvetica')
              .fontSize(6.5)

        }
      );

      /*
       * =====================================================
       * RÉSUMÉ FINANCIER
       * =====================================================
       */

      doc.moveDown(1);

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(
          'RÉSUMÉ FINANCIER'
        );

      doc.moveDown(0.4);

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(
          `Total ventes : ${totalVentes.toLocaleString('fr-FR')} FCFA`
        );

      doc
        .text(
          `Total services : ${totalServices.toLocaleString('fr-FR')} FCFA`
        );

      doc
        .text(
          `Total entrées : ${totalEntrees.toLocaleString('fr-FR')} FCFA`
        );

      doc
        .text(
          `Total dépenses : - ${totalDepenses.toLocaleString('fr-FR')} FCFA`
        );

      doc.moveDown(0.4);

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(
          `SOLDE NET : ${soldeNet.toLocaleString('fr-FR')} FCFA`,
          {
            align: 'right'
          }
        );

      /*
       * =====================================================
       * FIN PDF
       * =====================================================
       */

      doc.end();

    } catch (error) {

      console.error(
        'Erreur export PDF :',
        error
      );

      if (
        !res.headersSent
      ) {
        res.status(500).json({

          message:
            'Erreur lors de la génération du fichier PDF.',

          error:
            process.env.NODE_ENV ===
            'development'
              ? error.message
              : undefined

        });
      }

    }
  }
);

module.exports = router;