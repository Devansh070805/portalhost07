'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Code,
    Users,
    BarChart3,
    ArrowLeft,
    HelpCircle // <-- ADDED
} from 'lucide-react';
import { loginUser } from '../../../services/auth.js'; // Adjust path if needed
import Link from 'next/link'; // <-- ADDED

export default function LoginPage() {
    const [userType, setUserType] = useState<'student' | 'faculty' | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // --- Login logic remains unchanged ---
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
            const data = await loginUser(email, password, userType);
            if (typeof window !== 'undefined') {
                localStorage.setItem('userType', userType);
                localStorage.setItem('userEmail', data.email || '');
                localStorage.setItem('userId', data.id);
                localStorage.setItem('userName', data.name || '');
                localStorage.setItem('isAuthenticated', 'true');
                if (data.teamId) {
                    localStorage.setItem('teamId', data.teamId);
                } else {
                    localStorage.removeItem('teamId');
                }
                if (userType === 'student' && data.type) {
                    localStorage.setItem('studentType', data.type);
                } else {
                    localStorage.removeItem('studentType');
                }
            }
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

    // --- Updated Responsive Split-Screen Layout ---
    return (
<div className="min-h-screen flex flex-col md:flex-row bg-black md:bg-white">
            
            {/* --- ⭐ MODIFIED: Left Branding Side --- */}
            {/* Removed justify-center, will center content with an inner div */}
<div className="w-full md:w-1/2 bg-red-900 text-white p-8 md:p-12 flex flex-col min-h-[50vh] md:min-h-screen">
                {/* This div with 'my-auto' will center the block vertically */}
                <div className="my-auto"> 
                    <div className="mb-6">
                        <Code className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold mb-3">
                        Software Engineering Testing Portal
                    </h1>
                    <p className="text-2xl text-red-200 font-light mb-6">
                        UCS503
                    </p>
                    <p className="text-lg text-red-100 max-w-md">
  {userType === null 
    ? (
        <>
          Please select your role on the right to continue.
          <br />
          For any related queries contact: portaltesting733@gmail.com
        </>
      )
    : `You are logging in as a ${userType}.`
  }
</p>

                </div>
            </div>

            {/* --- Right Form Side (Unchanged) --- */}
            {/* ADDED 'relative' */}
<div className="w-full md:w-1/2 bg-gray-100 flex items-center justify-center p-8 md:p-12 relative min-h-[50vh] md:min-h-screen">
                
                {/* --- ADDED THIS BLOCK --- */}
                {userType && (
                    <Link
                        href={userType === 'student' ? '/studentfaq' : '/facultyfaq'}
                        className="absolute top-6 right-6 w-10 h-10 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-red-800 hover:border-red-800 transition-all"
                        title="View FAQ"
                    >
                        <HelpCircle className="w-6 h-6" />
                    </Link>
                )}
                {/* --- END OF ADDED BLOCK --- */}

                <div className="max-w-md w-full">
                    
                    {/* --- Conditional: Role Selection --- */}
                    {!userType ? (
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800 mb-8">
                                Select your role
                            </h2>
                            <div className="space-y-4">
                                <button
                                    onClick={() => setUserType('student')}
                                    className="w-full p-6 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl transition-all shadow-sm flex items-center gap-5"
                                >
                                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 text-red-800 rounded-lg flex items-center justify-center">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-800 mb-1 text-left">Student Login</h3>
                                        <p className="text-gray-600 text-sm text-left">Register your team and submit projects</p>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => setUserType('faculty')}
                                    className="w-full p-6 bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl transition-all shadow-sm flex items-center gap-5"
                                >
                                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 text-red-800 rounded-lg flex items-center justify-center">
                                        <BarChart3 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-800 mb-1 text-left">Faculty Login</h3>
                                        <p className="text-gray-600 text-sm text-left">Monitor projects and manage testing</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        
                        /* --- Conditional: Login Form --- */
                        <div>
                            <button 
                                onClick={() => setUserType(null)}
                                className="mb-6 text-gray-600 hover:text-red-800 flex items-center gap-2 font-medium"
                                disabled={loading}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to role selection
                            </button>
                            
                            <div className="text-left mb-8">
                                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                                    {userType === 'student' ? 'Student Login' : 'Faculty Login'}
                                </h1>
                                <p className="text-gray-600">Enter your credentials to continue.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-gray-700 mb-2 font-medium">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
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
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
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

                                <p className="text-sm text-gray-600 pt-4 text-center">
                                    Don't have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => router.push(userType === 'student' ? '/register' : '/faculty/register')}
                                        className="text-red-800 hover:underline font-semibold"
                                    >
                                        Register here
                                    </button>
                                </p>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}