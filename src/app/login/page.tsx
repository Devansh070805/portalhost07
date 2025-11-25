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
import { createSessionAndRedirect } from '../actions';

// --- Faculty Options ---
const FACULTY_EMAILS: Record<string, string> = {
    "Tanya Garg": "tanya.garg@thapar.edu",
    "Sandeep Kaur": "skaur2_phd23@thapar.edu",
    "Nisha Thakur": "nthakur_phd20@thapar.edu",
    "Reaya Grewal": "rgrewal_phd19@thapar.edu",
    "Deep": "deep.mann@thapar.edu",
    "Raghav B": "bv.raghav@thapar.edu",
    "Komal Bharti": "komal.bharti@thapar.edu",
    "Sukhpal Singh": "ssingh1_phd23@thapar.edu",
    "Damini":"darora_phd23@thapar.edu",
    "Ashima": "ashima@thapar.edu",
    "Admin":"portaltesting733@gmail.com",
};

export default function LoginPage() {
    const [userType, setUserType] = useState<'student' | 'faculty' | null>(null);
    const [email, setEmail] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState('');
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

        if (!password || !userType || (userType === 'student' && !email)) {
            setError('An error occurred. Please check your details.');
            setLoading(false);
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await user.reload();

            const userDoc = await getDoc(doc(db, userType === 'student' ? 'students' : 'faculty', user.uid));

            if (!userDoc.exists()) {
                setError('Your account profile was not found. Contact admin.');
                setLoading(false);
                return;
            }

            const data = userDoc.data();

            if (data.requiresVerification === true && !user.emailVerified) {
                setError('Your email is not verified yet. Please check your inbox.');
                setLoading(false);
                return;
            }

            if (typeof window !== 'undefined') {
                localStorage.setItem('userType', userType);
                localStorage.setItem('userEmail', user.email || '');
                localStorage.setItem('userId', user.uid);
                localStorage.setItem('userName', data.name || '');
                localStorage.setItem('isAuthenticated', 'true');

                if (data.teamId) localStorage.setItem('teamId', data.teamId);
                else localStorage.removeItem('teamId');

                if (userType === 'student' && data.type) {
                    localStorage.setItem('studentType', data.type);
                } else {
                    localStorage.removeItem('studentType');
                }
            }

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
            if (err.message === 'NEXT_REDIRECT') {
                return;
            }

            console.error(err);

            if (err instanceof FirebaseError) {
                switch (err.code) {
                    case "auth/invalid-credential":
                        setError("Incorrect email or password.");
                        break;
                    case "auth/invalid-email":
                        setError("Invalid email.");
                        break;
                    case "auth/user-disabled":
                        setError("This account has been disabled.");
                        break;
                    default:
                        setError("Login failed. Try again.");
                }
            } else {
                setError("Unexpected error occurred.");
            }
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            setError('Please enter your email to reset password.');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMessage('Password reset email sent.');
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') setError('No account found.');
            else setError('Error occurred. Try again.');
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-black md:bg-white">
            
            {/* LEFT SIDE */}
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

            {/* RIGHT SIDE */}
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
                                    className="w-full p-6 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition flex items-center gap-5"
                                >
                                    <div className="w-12 h-12 bg-red-100 text-red-800 rounded-lg flex items-center justify-center">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    <div>
                                         <h3 className="text-xl font-semibold text-gray-800 mb-1 text-left">Student Login</h3>
                                        <p className="text-gray-600 text-sm text-left">Register your team and submit projects</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setUserType('faculty')}
                                    className="w-full p-6 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition flex items-center gap-5"
                                >
                                    <div className="w-12 h-12 bg-red-100 text-red-800 rounded-lg flex items-center justify-center">
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
                                className="mb-6 text-gray-600 hover:text-red-800 flex items-center gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>

                            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                                {userType === 'student' ? "Student Login" : "Faculty Login"}
                            </h1>

                            <form onSubmit={handleSubmit} className="space-y-4">

                                {/* STUDENT EMAIL INPUT */}
                                {userType === 'student' && (
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-medium">Email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email"
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800"
                                            required
                                        />
                                    </div>
                                )}

                                {/* FACULTY DROPDOWN */}
                                {userType === 'faculty' && (
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-medium">Select Faculty</label>

                                        <select
                                            value={selectedFaculty}
                                            onChange={(e) => {
                                                const name = e.target.value;
                                                setSelectedFaculty(name);
                                                setEmail(FACULTY_EMAILS[name]);
                                            }}
                                            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800"
                                            required
                                        >
                                            <option value="">Select Faculty</option>

                                            {Object.keys(FACULTY_EMAILS).map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>

                                        {/* Hidden email */}
                                        <input type="hidden" value={email} readOnly />
                                    </div>
                                )}

                                {/* PASSWORD */}
                                <div>
                                    <label className="block text-gray-700 mb-2 font-medium">Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800"
                                        required
                                    />
                                </div>

                                {/* Forgot Password (Students Only) also for faculty now */}
                                
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

                                {/* REGISTER (Students ONLY) */}
                                {userType === 'student' && (
                                    <p className="text-sm text-gray-600 pt-4 text-center">
                                        Don't have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => router.push('/register')}
                                            className="text-red-800 hover:underline font-semibold"
                                        >
                                            Register here
                                        </button>
                                    </p>
                                )}

                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
