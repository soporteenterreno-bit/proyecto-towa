import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, role, signInWithGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && role) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, role, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-dark"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-gray px-4">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center">
        
        {/* Logo Section */}
        <div className="h-32 w-32 mb-2 rounded-full overflow-hidden shadow-sm border border-gray-100 flex items-center justify-center bg-brand-dark">
          {/* We point to /logo.png which the user will upload to the public folder */}
          <img 
            src="/logo.png" 
            alt="Towa Logo" 
            className="h-full w-full object-cover"
            onError={(e) => {
              // Fallback styling if image is not yet uploaded
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '<span class="text-white text-3xl font-bold font-serif italic">Towa.</span>';
            }}
          />
        </div>

        <div className="text-center w-full">
          <h2 className="mt-2 text-3xl font-extrabold text-brand-dark tracking-tight">
            Acceso Corporativo
          </h2>
          <p className="mt-2 text-sm text-gray-500 font-medium tracking-wide uppercase">
            Sistema de Gestión Técnica
          </p>
        </div>
        
        <div className="mt-10 w-full">
          <button
            onClick={signInWithGoogle}
            className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-brand-dark hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition-all shadow-md hover:shadow-lg"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-4">
              <svg className="h-5 w-5 text-white/80 group-hover:text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
              </svg>
            </span>
            Continuar con Google
          </button>
        </div>
      </div>
    </div>
  );
}
