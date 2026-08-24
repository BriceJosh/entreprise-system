import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import { BACKEND_URL } from "../config/api";
import { imprimerRecu } from "../utils/imprimerRecu";

/*
 * =========================================================
 * PAGE : REÇUS DU JOUR
 * =========================================================
 *
 * Liste des reçus créés aujourd'hui avec :
 *
 * - Total encaissé du jour
 * - Nombre de reçus
 * - Bouton de réimpression pour chaque reçu
 * =========================================================
 */

function dateInput(date) {
  return date.toLocaleDateString("sv-SE");
}

export default function Recus({ profil }) {
  const estDirection = profil?.role === "directeur" || profil?.role === "admin";

  const retour = estDirection
    ? "/dashboard-directeur"
    : "/dashboard-secretaire";

  const [recus, setRecus] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [periode, setPeriode] = useState("jour");

  const [dates, setDates] = useState(() => {
    const aujourdHui = new Date();

    return {
      debut: dateInput(aujourdHui),
      fin: dateInput(aujourdHui),
    };
  });

  /*
   * =======================================================
   * CHARGER LES REÇUS
   * =======================================================
   */

  useEffect(() => {
    chargerRecus();
  }, []);

  async function chargerRecus() {
    try {
      setLoading(true);

      setError("");

      const token = localStorage.getItem("token");

      const response = await fetch(`${BACKEND_URL}/api/recus`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors du chargement des reçus.");
      }

      const data = await response.json();

      setRecus(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);

      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /*
   * =======================================================
   * FILTRAGE PAR PÉRIODE
   * =======================================================
   */

  const recusFiltres = useMemo(() => {
    if (periode === "tous") {
      return recus;
    }

    const debut = new Date(`${dates.debut}T00:00:00`);
    const fin = new Date(`${dates.fin}T23:59:59.999`);

    return recus.filter((recu) => {
      const date = new Date(recu.createdAt);

      return date >= debut && date <= fin;
    });
  }, [recus, periode, dates]);

  const totalPeriode = useMemo(
    () =>
      recusFiltres.reduce(
        (somme, recu) => somme + Number(recu.montant_total || 0),
        0,
      ),
    [recusFiltres],
  );

  /*
   * =======================================================
   * RÉIMPRESSION
   * =======================================================
   */

  async function reimprimer(recuId) {
    setError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${BACKEND_URL}/api/recus/${recuId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Impossible de récupérer ce reçu.");
      }

      const recu = await response.json();

      imprimerRecu(recu);
    } catch (err) {
      setError(err.message);
    }
  }

  /*
   * =======================================================
   * AFFICHAGE
   * =======================================================
   */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ======================================================
          EN-TÊTE
          ====================================================== */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-emerald-50 text-emerald-600 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full">
              Caisse
            </span>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 mt-1">
              Reçus Clients
            </h1>
            <p className="text-xs text-gray-500">
              Suivi des encaissements et réimpression des reçus
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={retour}
              className="bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold py-2 px-4 rounded-xl text-xs uppercase transition-all"
            >
              Tableau de bord
            </Link>
            <Link
              to="/profil"
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold py-2 px-4 rounded-xl text-xs uppercase transition-all"
            >
              Profil
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* ====================================================
            RÉSUMÉ DE LA PÉRIODE
            ==================================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-600 uppercase">
              Total encaissé
            </p>
            <p className="text-2xl font-black text-emerald-800 mt-1">
              {totalPeriode.toLocaleString("fr-FR")} FCFA
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100">
            <p className="text-xs font-bold text-blue-600 uppercase">
              Nombre de reçus
            </p>
            <p className="text-2xl font-black text-blue-800 mt-1">
              {recusFiltres.length}
            </p>
          </div>
        </div>

        {/* ====================================================
            FILTRES DE PÉRIODE
            ==================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              Période
            </label>

            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              className="p-3 rounded-xl border bg-gray-50 text-sm"
            >
              <option value="jour">Par dates</option>
              <option value="tous">Tout l'historique</option>
            </select>
          </div>

          {periode === "jour" && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Du
                </label>

                <input
                  type="date"
                  value={dates.debut}
                  onChange={(e) =>
                    setDates((prev) => ({
                      ...prev,
                      debut: e.target.value,
                    }))
                  }
                  className="p-3 rounded-xl border bg-gray-50 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Au
                </label>

                <input
                  type="date"
                  value={dates.fin}
                  onChange={(e) =>
                    setDates((prev) => ({
                      ...prev,
                      fin: e.target.value,
                    }))
                  }
                  className="p-3 rounded-xl border bg-gray-50 text-sm"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={chargerRecus}
            className="px-4 py-3 rounded-xl bg-gray-900 text-white text-xs font-bold"
          >
            Actualiser
          </button>
        </div>

        {/* ====================================================
            LISTE DES REÇUS
            ==================================================== */}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {loading ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : recusFiltres.length === 0 ? (
            <p className="text-sm text-gray-400">
              Aucun reçu sur cette période.
            </p>
          ) : (
            <ul className="space-y-2">
              {recusFiltres.map((recu) => (
                <li
                  key={recu._id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">
                      {recu.numero}
                      {recu.nom_client ? ` — ${recu.nom_client}` : ""}
                    </p>

                    <p className="text-xs text-gray-400">
                      {new Date(recu.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" — "}
                      {recu.lignes?.length || 0} article(s)
                      {" — "}
                      {(recu.montant_total || 0).toLocaleString("fr-FR")} FCFA
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => reimprimer(recu._id)}
                    className="shrink-0 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 transition-colors"
                  >
                    Réimprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
