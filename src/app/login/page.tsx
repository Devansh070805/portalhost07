'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Code,
    Users,
    BarChart3,
    ArrowLeft,
    HelpCircle
} from 'lucide-react';
import { sendPasswordResetEmail } from "firebase/auth";
import Link from 'next/link';

import { signInWithEmailAndPassword } from "firebase/auth";
import { getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../../services/firebaseConfig.js';
import { FirebaseError } from "firebase/app";
// Import the server action we created
import { createSessionAndRedirect } from '../actions'; 

export default function LoginPage() {
    const [userType, setUserType] = useState<'student' | 'faculty' | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        if (!email || !password || !userType) {
            setError('An error occurred. Please go back and select a role.');
            setLoading(false);
            return;
        }

        try {
            // 1. Authenticate with Firebase (Client Side)
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            await user.reload(); // Refresh auth state
            
            // 2. Fetch Firestore profile
            const userDoc = await getDoc(doc(db, userType === 'student' ? 'students' : 'faculty', user.uid));
            
            if (!userDoc.exists()) {
                setError('Your account profile was not found. Contact admin.');
                setLoading(false);
                return;
            }
            
            const data = userDoc.data();

            // 3. Check email verification
            if (data.requiresVerification === true && !user.emailVerified) {
                setError('Your email is not verified yet. Please check your inbox and verify your email before logging in.');
                setLoading(false);
                return;
            }
            
            // 4. Store client-side persistence (LocalStorage)
            if (typeof window !== 'undefined') {
                localStorage.setItem('userType', userType);
                localStorage.setItem('userEmail', user.email || '');
                localStorage.setItem('userId', user.uid);
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

            // 5. CALL SERVER ACTION for SSR Cookies & Redirect
            // This replaces document.cookie and router.push
            await createSessionAndRedirect(
                {
                    email: user.email,
                    name: data.name,
                    teamId: data.teamId,
                    role: userType,
                    studentType: data.type
                },
                userType === 'student' ? '/dashboard' : '/faculty/dashboard'
            );

        } catch (err: any) {
            // IMPORTANT: Next.js Server Action Redirects throw a specific error.
            // We must catch it and ignore it, otherwise it looks like a crash.
            if (err.message === 'NEXT_REDIRECT') {
                return; // Redirect is happening, do nothing.
            }

            console.error(err);

            if (err instanceof FirebaseError) {
                switch (err.code) {
                    case "auth/invalid-credential":
                        setError("Incorrect email or password.");
                        break;
                    case "auth/invalid-email":
                        setError("Please enter a valid email.");
                        break;
                    case "auth/user-disabled":
                        setError("This account has been disabled. Contact admin.");
                        break;
                    default:
                        setError("Login failed. Please try again.");
                }
            } else {
                setError("Unexpected error occurred. Try again.");
            }
            setLoading(false);
        }
    };

    // --- handlePasswordReset logic remains unchanged ---
    const handlePasswordReset = async () => {
        if (!email) {
            setError('Please enter your email address to reset your password.');
            setSuccessMessage(null);
            return;
        }
        
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMessage('Password reset email sent! Please check your inbox (and spam folder).');
        } catch (err: any) {
            console.error('Password reset error:', err);
            if (err.code === 'auth/user-not-found') {
                setError('No account found with this email address.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Please enter a valid email address.');
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-black md:bg-white">
            
            {/* --- Left Branding Side --- */}
            <div className="w-full md:w-1/2 bg-red-900 text-white p-8 md:p-12 flex flex-col min-h-[50vh] md:min-h-screen">
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

            {/* --- Right Form Side --- */}
            <div className="w-full md:w-1/2 bg-gray-100 flex items-center justify-center p-8 md:p-12 relative min-h-[50vh] md:min-h-screen">
                
                {userType && (
                    <Link
                        href={userType === 'student' ? '/studentfaq' : '/facultyfaq'}
                        className="absolute top-6 right-6 w-10 h-10 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:text-red-800 hover:border-red-800 transition-all"
                        title="View FAQ"
                    >
                        <HelpCircle className="w-6 h-6" />
                    </Link>
                )}

                <div className="max-w-md w-full">
                    
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

                                <div className="text-right -mt-2">
                                     <button
                                         type="button"
                                         onClick={handlePasswordReset}
                                         disabled={loading}
                                         className="text-sm font-medium text-red-800 hover:underline disabled:opacity-50"
                                     >
                                         Forgot your password?
                                     </button>
                                 </div>

                                 {successMessage && (
                                    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                                        <p className="text-green-800 text-sm">{successMessage}</p>
                                    </div>
                                )}

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