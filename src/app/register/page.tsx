'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Code, ArrowLeft } from 'lucide-react';
// import { createStudent } from '../../../services/auth.js'; // This seems unused

import { auth, db } from '../../../services/firebaseConfig.js'
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';

export default function StudentRegister() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    subgroup: '',
    type: 'MEMBER',
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

const subgroupsUndertaking = [
  '3C51','3C55','3Q13','3Q14','3Q21',
  '3C32','3C44','3C25','3Q11','3C22','3C35',
  '3C31','3C53','3C73',
  '3C33','3C42','3C54','3C63','3C65',
  '3C45','3P14','3Q16','3C17','3C18',
  '3C41','3C43','3C62','3C71',
  '3Q12','3C72','3P12','3C34','3C13',
  '3Q15','3C24','3Q26','3P11','3C16',
  '3C52','3C61','3C64','3Q23','3Q24','3P13',
  '3C15','3C21','3Q22','3C75','3C23',
  '3C11', '3C12', '3C74', '3Q25'
];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!formData.email.toLowerCase().endsWith('@thapar.edu')) {
      setError('Invalid email. Please use your @thapar.edu email address to register.');
      setLoading(false);
      return;
    }

    if (!formData.subgroup.trim()) {
      setError('Please select a subgroup name');
      setLoading(false);
      return;
    }

    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const user = userCredential.user;

      // 2. Send the verification email
      auth.languageCode = 'en';
      await sendEmailVerification(user);


      // 3. Create the student document in Firestore
      await setDoc(doc(db, 'students', user.uid), {
        name: formData.name,
        email: formData.email,
        type: formData.type,
        subgroup: formData.subgroup,
        teamId: null,
        teamName: null,
        requiresVerification: true, // <-- ✅ ADDED THIS FLAG
      });

      // 4. Show a success message instead of redirecting
      setSuccessMessage(
        'Registration successful! A verification link has been sent to your email. Please verify your account before logging in.'
      );
      // We don't redirect, so the user sees the message

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use by another account.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // --- JSX (Return) remains unchanged ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left branding side */}
      <div className="w-full md:w-1/2 bg-red-900 text-white p-8 md:p-12 flex flex-col md:h-screen">
        <div className="my-auto">
          <div className="mb-6">
            <Code className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-3">
            Software Engineering Testing Portal
          </h1>
          <p className="text-2xl text-red-200 font-light mb-6">UCS503</p>
          <p className="text-lg text-red-100 max-w-md">
            Create your student account to register your team and submit your project.
          </p>
        </div>
      </div>

      {/* Right form side */}
      <div className="w-full md:w-1/2 bg-gray-100 flex items-center md:items-start justify-center p-8 md:p-12 md:h-screen md:overflow-y-auto">
        <div className="max-w-md w-full">
          <button
            onClick={() => router.push('/login')}
            className="mb-6 text-gray-600 hover:text-red-800 flex items-center gap-2 font-medium"
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>

          <div className="text-left mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Student Registration</h1>
            <p className="text-gray-600">Create your account to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2 font-medium">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your full name"
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your @thapar.edu email"
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">Role</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              >
                <option value="MEMBER">Team Member</option>
                <option value="LEADER">Team Leader</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                Subgroup Name
              </label>
              <select
                name="subgroup"
                value={formData.subgroup}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              >
                <option value="">Select your subgroup</option>
                {subgroupsUndertaking.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
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
              disabled={loading}
              className="w-full py-3 bg-red-800 hover:bg-red-900 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}