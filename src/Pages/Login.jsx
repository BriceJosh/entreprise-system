import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const auth = useAuth();
  const login = auth?.login;
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setLoading(true);

    try {
      let userData = null;

      if (login) {
        // Authentification via AuthContext (gère le stockage du token et de l'utilisateur avec son guichet)
        userData = await login(email, password);
      } else {
        // Requête HTTP directe par défaut (fallback)
        const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Identifiants invalides');
        }

        // Sauvegarde complète dans localStorage (incluant data.user.site)
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

        userData = data.user || data;
      }

      // 1. Redirection prioritaire si le mot de passe doit être changé
      if (userData?.doit_changer_mdp) {
        navigate('/changer-mdp');
        return;
      }

      // 2. Redirection automatique selon le rôle
      const userRole = userData?.role || userData?.profil?.role;
      if (userRole === 'directeur' || userRole === 'admin') {
        navigate('/dashboard-directeur');
      } else {
        navigate('/dashboard-secretaire');
      }

    } catch (err) {
      console.error('Erreur de connexion :', err);
      setErreur(err.message || 'Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">

        {/* En-tête */}
        <div className="text-center space-y-2">
          <img
            src="/Logo.jpeg"
            alt="Logo Entreprise System"
            className="w-20 h-20 mx-auto rounded-2xl object-contain shadow-sm border border-gray-100 p-1 mb-2"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="bg-emerald-50 text-emerald-700 font-bold text-[11px] uppercase px-3 py-1 rounded-full tracking-wider">
            Entreprise System - Supervision &amp; Caisse
          </span>
          <h1 className="text-2xl font-black text-gray-800 mt-2">Connexion au Système</h1>
          <p className="text-xs text-gray-500">Accédez à votre espace de gestion personnalisé</p>
        </div>

        {/* Message d'erreur */}
        {erreur && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 text-center font-semibold">
            ⚠️ {erreur}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Adresse Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: secretaire@rocher.com"
              className="w-full p-3 border rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-3 border rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-3.5 rounded-xl text-sm transition-all uppercase tracking-wider shadow-sm cursor-pointer mt-2"
          >
            {loading ? 'Connexion en cours...' : 'Se Connecter'}
          </button>
        </form>

      </div>
    </div>
  );
}