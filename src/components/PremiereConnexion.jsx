import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BACKEND_URL } from '../config/api';

export default function PremiereConnexion() {
  const [nouveauPassword, setNouveauPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const { token, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');

    // Vérification de la correspondance des mots de passe
    if (nouveauPassword !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }

    if (nouveauPassword.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/changer-mdp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // On envoie le token pour identifier l'utilisateur
        },
        body: JSON.stringify({ nouveauPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la mise à jour du mot de passe.');
      }

      // Mise à jour de l'utilisateur dans le contexte (doit_changer_mdp passe à false)
      if (updateUser) {
        updateUser(data.user || { doit_changer_mdp: false });
      }

      // Redirection définitive vers le bon dashboard selon le rôle
      const userRole = data.user?.role;
      if (userRole === 'directeur' || userRole === 'admin') {
        navigate('/dashboard-directeur');
      } else {
        navigate('/dashboard-secretaire');
      }

    } catch (error) {
      setErreur(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto w-full max-w-md">
        <h2 className="mt-6 text-center text-3xl font-black text-gray-950 tracking-tight">
          Sécurité requise
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          C'est votre première connexion. Veuillez définir un nouveau mot de passe personnel pour continuer.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto w-full max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl border border-gray-100 sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {erreur && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg">
                {erreur}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={nouveauPassword}
                onChange={(e) => setNouveauPassword(e.target.value)}
                className="w-full p-3 border rounded-lg bg-gray-50 text-sm font-medium outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full p-3 border rounded-lg bg-gray-50 text-sm font-medium outline-none focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm uppercase tracking-wider shadow-sm cursor-pointer disabled:bg-blue-300 transition-colors"
            >
              {loading ? 'Enregistrement...' : 'Valider et continuer'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}