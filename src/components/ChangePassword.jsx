import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const BACKEND_URL = 'http://localhost:5000';

export default function ChangePassword() {
  const [ancienMotDePasse, setAncienMotDePasse] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState({ texte: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ texte: '', type: '' });

    if (nouveauMotDePasse !== confirmation) {
      return setMessage({ texte: "Les nouveaux mots de passe ne correspondent pas.", type: 'erreur' });
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'PUT', // ou POST selon ta configuration backend
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Crucial pour identifier l'utilisateur
        },
        body: JSON.stringify({ ancienMotDePasse, nouveauMotDePasse })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur lors de la modification.");
      }

      setMessage({ texte: "Mot de passe modifié avec succès !", type: 'succes' });
      setAncienMotDePasse('');
      setNouveauMotDePasse('');
      setConfirmation('');

    } catch (error) {
      setMessage({ texte: error.message, type: 'erreur' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-md mt-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">Modifier le mot de passe</h2>
      
      {message.texte && (
        <div className={`p-3 text-sm font-semibold rounded-xl mb-4 ${message.type === 'erreur' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message.texte}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ancien mot de passe</label>
          <input 
            type="password" 
            value={ancienMotDePasse} 
            onChange={(e) => setAncienMotDePasse(e.target.value)} 
            className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" 
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nouveau mot de passe</label>
          <input 
            type="password" 
            value={nouveauMotDePasse} 
            onChange={(e) => setNouveauMotDePasse(e.target.value)} 
            className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" 
            required 
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmer le nouveau</label>
          <input 
            type="password" 
            value={confirmation} 
            onChange={(e) => setConfirmation(e.target.value)} 
            className="w-full p-2.5 border rounded-xl bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500" 
            required 
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-xl text-sm transition-all"
        >
          {loading ? 'Modification...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}