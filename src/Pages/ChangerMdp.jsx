import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../config/api';

export default function ChangerMdp() {
  const [ancienMdp, setAncienMdp] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    setMessage('');

    if (nouveauMdp !== confirmation) {
      setErreur('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`${BACKEND_URL}/api/auth/changer-mdp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ancienMdp, nouveauMdp })
      });

      const data = await res.json();

      if (res.ok) {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            parsed.doit_changer_mdp = false;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch (e) {
          console.error(e);
        }
        setMessage('Mot de passe mis à jour avec succès ! Redirection...');
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else {
        setErreur(data.message || 'Erreur lors du changement de mot de passe.');
      }
    } catch (err) {
      console.error('Erreur lors de la modification du mot de passe :', err);
      setErreur('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">
        <h2 className="text-xl font-black text-gray-800 mb-2">Changer le mot de passe</h2>
        <p className="text-xs text-gray-500 mb-6">
          Veuillez définir un nouveau mot de passe pour sécuriser votre compte.
        </p>

        {erreur && <div className="p-3 mb-4 text-xs bg-red-50 text-red-600 rounded-xl font-bold">{erreur}</div>}
        {message && <div className="p-3 mb-4 text-xs bg-emerald-50 text-emerald-600 rounded-xl font-bold">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Ancien mot de passe</label>
            <input
              type="password"
              required
              value={ancienMdp}
              onChange={(e) => setAncienMdp(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              required
              value={nouveauMdp}
              onChange={(e) => setNouveauMdp(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full p-3 border rounded-xl bg-gray-50 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? 'Mise à jour...' : 'Mettre à jour'}
          </button>
        </form>
      </div>
    </div>
  );
}