import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function Profil({ profil: propsProfil }) {
  const { user: contextUser, updateUser } = useAuth();

  // Priorité aux données du contexte auth, fallback sur les props
  const user = contextUser || propsProfil;

  const [ancienMotDePasse, setAncienMotDePasse] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmerMotDePasse, setConfirmerMotDePasse] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangerMotDePasse = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (nouveauMotDePasse !== confirmerMotDePasse) {
      setMessage({ type: 'error', texte: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }

    if (nouveauMotDePasse.length < 6) {
      setMessage({ type: 'error', texte: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/users/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ancienMotDePasse, nouveauMotDePasse })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', texte: 'Mot de passe modifié avec succès !' });
        setAncienMotDePasse('');
        setNouveauMotDePasse('');
        setConfirmerMotDePasse('');

        // Mise à jour locale du statut du mot de passe si nécessaire
        if (user?.doit_changer_mdp) {
          updateUser({ doit_changer_mdp: false });
        }
      } else {
        setMessage({ type: 'error', texte: data.message || 'Erreur lors de la modification.' });
      }
    } catch (error) {
      console.error('Erreur changement mot de passe :', error);
      setMessage({ type: 'error', texte: 'Impossible de contacter le serveur.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Détermination de la route de retour
  const userRole = user?.role || user?.profil?.role;
  const lienRetour = (userRole === 'directeur' || userRole === 'admin') 
    ? '/dashboard-directeur' 
    : '/dashboard-secretaire';

  // Formatage du nom/emplacement du site
  const siteNom = user?.site?.nom || user?.site_id?.nom || user?.site_id || "Général";
  const siteVille = user?.site?.ville || user?.site_id?.ville;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      
      {/* En-tête de la page Profil */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Mon Profil & Sécurité</h1>
          <Link 
            to={lienRetour} 
            className="text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors mt-1 inline-block"
          >
            &larr; Retour au tableau de bord
          </Link>
        </div>
        
        {/* Bouton de déconnexion */}
        <LogoutButton />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Section 1 : Informations de l'utilisateur */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-3">
            <span className="w-2.5 h-5 bg-emerald-600 rounded-full"></span>
            <h2 className="text-lg font-bold text-gray-800">Mes Informations</h2>
          </div>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Email / Identifiant</p>
              <p className="text-lg font-semibold text-gray-800">{user?.email || user?.username || "Non renseigné"}</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Rôle</p>
              <p className="text-lg font-semibold text-gray-800 capitalize">{userRole || "Non renseigné"}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Site / Guichet affecté</p>
              <p className="text-lg font-semibold text-gray-800">
                {siteNom} {siteVille ? `(${siteVille})` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2 : Changement de mot de passe */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-3">
            <span className="w-2.5 h-5 bg-orange-500 rounded-full"></span>
            <h2 className="text-lg font-bold text-gray-800">Changer de Mot de Passe</h2>
          </div>

          <form onSubmit={handleChangerMotDePasse} className="space-y-4">
            {message && (
              <div 
                className={`p-4 rounded-xl text-xs font-bold ${
                  message.type === 'error' 
                    ? 'bg-red-50 text-red-600 border border-red-200' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {message.type === 'error' ? '⚠️ ' : '✅ '}
                {message.texte}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Ancien mot de passe
              </label>
              <input 
                type="password"
                value={ancienMotDePasse}
                onChange={(e) => setAncienMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 border rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Nouveau mot de passe
              </label>
              <input 
                type="password"
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 border rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input 
                type="password"
                value={confirmerMotDePasse}
                onChange={(e) => setConfirmerMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 border rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl text-sm transition-all uppercase tracking-wider shadow-sm mt-2 cursor-pointer"
            >
              {isSubmitting ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}