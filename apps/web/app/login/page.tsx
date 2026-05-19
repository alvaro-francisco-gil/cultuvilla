'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createUserProfile } from '@cultuvilla/shared/services/userService';

export default function LoginPage() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.push('/');
  }, [user, router]);

  if (user) return null;

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) throw new Error('El nombre es obligatorio');
        if (!birthday) throw new Error('La fecha de nacimiento es obligatoria');

        await signUpWithEmail(email, password);
        // After signUpWithEmail, user will be set by onAuthStateChanged.
        // We need the uid — get it from the auth module directly.
        const { getAuth } = await import('@cultuvilla/shared/firebase');
        const uid = getAuth().currentUser?.uid;
        if (uid) {
          await createUserProfile(uid, {
            displayName: displayName.trim(),
            email,
            birthday: new Date(birthday),
          });
        }
        router.push('/');
      } else {
        await signInWithEmail(email, password);
        router.push('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Cultuvilla</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSignUp ? 'Crea tu cuenta' : 'Inicia sesión para continuar'}
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 bg-white px-4 py-3 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          Continuar con Google
        </button>

        <div className="relative flex items-center">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-3 text-xs text-gray-400">o con email</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Nombre completo"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1 ml-1">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Cargando...' : isSignUp ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-blue-600 hover:underline font-medium"
          >
            {isSignUp ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </div>
    </div>
  );
}
