import { useState } from 'react';

export default function Login({ onLoginSuccess }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      sessionStorage.setItem('kryonixSessionToken', token.trim());
      
      const response = await fetch('/version', {
        headers: { 'Authorization': `Bearer ${token.trim()}` }
      });
      
      if (!response.ok) {
        throw new Error('Token inválido');
      }

      onLoginSuccess();
    } catch (err) {
      sessionStorage.removeItem('kryonixSessionToken');
      setError('Token inválido ou incorreto. Verifique o console da máquina alvo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex justify-center">
          <svg viewBox="0 0 200 80" className="h-12 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="1"/>
                <stop offset="100%" stopColor="#a855f7" stopOpacity="1"/>
              </linearGradient>
            </defs>
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle"
                  fontFamily="system-ui, sans-serif" fontSize="42" fontWeight="800"
                  fill="url(#grad)" letterSpacing="-0.02em">Kryonix</text>
          </svg>
        </div>
        
        <h2 className="mb-2 text-xl font-bold text-white text-center">Acesso Remoto Protegido</h2>
        <p className="mb-6 text-sm text-slate-400 text-center">
          O instalador está sendo executado no modo Live Remote. Digite o Session Token de segurança exibido no terminal da máquina alvo.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Session Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="Ex: aB3dE5fG..."
              required
              autoFocus
            />
          </div>

          {error && <div className="text-sm text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="mt-2 w-full rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Autenticar'}
          </button>
        </form>
      </div>
    </div>
  );
}
