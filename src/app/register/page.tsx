'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Code, ArrowLeft } from 'lucide-react';
// <<< 1. IMPORT YOUR createStudent FUNCTION >>>
import { createStudent } from '../../../services/auth.js'; // Adjust path if needed

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
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // <<< 2. THIS FUNCTION IS UNCHANGED >>>
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // --- Thapar Email Validation ---
    if (!formData.email.toLowerCase().endsWith('@thapar.edu')) {
      setError(
        'Invalid email. Please use your @thapar.edu email address to register.'
      );
      setLoading(false);
      return;
    }
    // --- End of validation ---

    if (!formData.subgroup.trim()) {
      setError('Please enter a subgroup name');
      setLoading(false);
      return;
    }

    try {
      const newUserId = await createStudent(
        formData.name,
        formData.email,
        formData.type, // 'MEMBER' or 'LEADER'
        formData.password,
        formData.subgroup
      );

      if (newUserId) {
        alert('Registration successful! Please login.');
        router.push('/login');
      } else {
        setError('Registration failed. The email might already be in use.');
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // <<< END OF UPDATED FUNCTION >>>

  // --- ⭐ MODIFIED: Applying new split-screen layout ---
  return (
    // The outer container handles mobile (flex-col) and desktop (md:flex-row)
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* --- ⭐ Left Branding Side ---
      * 'md:h-screen' makes it full height on desktop.
      * 'md:sticky md:top-0' could also work, but h-screen is cleaner here.
      --- */}
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
            Create your student account to register your team and submit your
            project.
          </p>
        </div>
      </div>

      {/* --- ⭐ Right Form Side ---
      * 'md:h-screen' makes it full height on desktop.
      * 'md:overflow-y-auto' makes ONLY this panel scrollable.
      * 'md:items-start' aligns the form to the top on desktop (so you see the start of the form).
      --- */}
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Student Registration
            </h1>
            <p className="text-gray-600">
              Create your account to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2 font-medium">
                Name
              </label>
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
              <label className="block text-gray-700 mb-2 font-medium">
                Email
              </label>
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
              <label className="block text-gray-700 mb-2 font-medium">
                Password
              </label>
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
              <label className="block text-gray-700 mb-2 font-medium">
                Role
              </label>
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
              <input
                type="text"
                name="subgroup"
                value={formData.subgroup}
                onChange={handleChange}
                placeholder="Enter your subgroup"
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              />
            </div>

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

