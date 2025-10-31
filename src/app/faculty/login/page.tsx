// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Code, Users, BarChart3 } from 'lucide-react';
import { loginUser } from '../../../../services/auth.js'; // Import loginUser

export default function LoginPage() {
  const [userType, setUserType] = useState<'student' | 'faculty' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password || !userType) {
      setError('An error occurred. Please go back and select a role.');
      setLoading(false);
      return;
    }

    try {
      // Call our Firebase login function, passing in the userType
      const data = await loginUser(email, password, userType);

      // Store user data in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('userType', userType);
        localStorage.setItem('userEmail', data.email || ''); 
        localStorage.setItem('userId', data.id);
        localStorage.setItem('userName', data.name || ''); 
        localStorage.setItem('isAuthenticated', 'true');
        
        if (data.teamId) {
          localStorage.setItem('teamId', data.teamId);
        }
        
        if (userType === 'student' && data.type) {
          localStorage.setItem('studentType', data.type); 
        }
      }

      // Redirect based on user role
      if (userType === 'student') {
        router.push('/dashboard');
      } else {
        router.push('/faculty/dashboard');
      }

    } catch (err: any) { 
      console.error('Login error:', err);
      setError(err.message || 'An error occurred. Please try again.'); 
    } finally {
      setLoading(false);
    }
  };

  if (!userType) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-800 rounded-2xl mb-4">
              <Code className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Project Testing Portal</h1>
            <p className="text-gray-600">Select your role to continue</p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => setUserType('student')}
              className="w-full p-6 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl transition-all shadow-sm"
            >
              <Users className="w-8 h-8 text-red-800 mb-3 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-800 mb-1">Student Login</h3>
              <p className="text-gray-600 text-sm">Register your team and submit projects</p>
            </button>
            
            <button
              onClick={() => setUserType('faculty')}
              className="w-full p-6 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl transition-all shadow-sm"
            >
              <BarChart3 className="w-8 h-8 text-red-800 mb-3 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-800 mb-1">Faculty Login</h3>
              <p className="text-gray-600 text-sm">Monitor projects and manage testing</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border-2 border-gray-300 rounded-xl p-8 shadow-sm">
        <button 
          onClick={() => setUserType(null)}
          className="mb-4 text-gray-600 hover:text-gray-800"
          disabled={loading}
        >
          ← Back
        </button>
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-800 rounded-2xl mb-4">
            {userType === 'student' ? <Users className="w-8 h-8 text-white" /> : <BarChart3 className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {userType === 'student' ? 'Student Login' : 'Faculty Login'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-3 bg-red-800 hover:bg-red-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <p className="text-sm text-gray-500 mt-4 text-center">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => router.push(userType === 'student' ? '/register' : '/faculty/register')}
              className="text-red-800 hover:underline font-medium"
            >
              Register here
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}