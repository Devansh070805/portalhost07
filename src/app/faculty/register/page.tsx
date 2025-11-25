'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Code, ArrowLeft } from 'lucide-react'; // Added icons
import { createFaculty } from '../../../../services/auth.js'; // Import createFaculty

export default function FacultyRegister() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    subgroups: '', // Field for subgroups
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Split the comma-separated string into an array of strings
    const subgroupsArray = formData.subgroups
      .split(',')
      .map((s) => s.trim()) // Remove whitespace
      .filter((s) => s.length > 0); // Remove empty strings

    if (subgroupsArray.length === 0) {
      setError('Please enter at least one subgroup.');
      setLoading(false);
      return;
    }

    try {
      // Call the createFaculty function
      const newUserId = await createFaculty(
        formData.name,
        formData.email,
        subgroupsArray,
        formData.password
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

  // --- ⭐ MODIFIED: Applying new split-screen layout ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* --- ⭐ Left Branding Side --- */}
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
            Create your faculty account to manage subgroups and monitor project
            testing.
          </p>
        </div>
      </div>

      {/* --- ⭐ Right Form Side (Scrollable) --- */}
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
              Faculty Registration
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
                placeholder="Enter your email"
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
                Subgroups Undertaking
              </label>
              <input
                type="text"
                name="subgroups"
                value={formData.subgroups}
                onChange={handleChange}
                placeholder="e.g. 3Q15,3C25"
                required
                className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-gray-800 placeholder-gray-500 focus:outline-none focus:border-red-800 focus:ring-1 focus:ring-red-800"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter subgroups separated by commas.
              </p>
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
// 'use client';

// import { ArrowLeft, Code } from 'lucide-react';
// import { useRouter } from 'next/navigation';

// export default function FacultyRegister() {
//   const router = useRouter();

//   return (
//     <div className="min-h-screen flex flex-col md:flex-row">
      
//       {/* Left Branding Side */}
//       <div className="w-full md:w-1/2 bg-red-900 text-white p-8 md:p-12 flex flex-col md:h-screen">
//         <div className="my-auto">
//           <div className="mb-6">
//             <Code className="w-12 h-12 text-white" />
//           </div>
//           <h1 className="text-4xl lg:text-5xl font-bold mb-3">
//             Software Engineering Testing Portal
//           </h1>
//           <p className="text-2xl text-red-200 font-light mb-6">UCS503</p>
//           <p className="text-lg text-red-100 max-w-md">
//             Faculty registrations are closed.
//           </p>
//         </div>
//       </div>

//       {/* Right Side */}
//       <div className="w-full md:w-1/2 bg-gray-100 flex items-center md:items-start justify-center p-8 md:p-12 md:h-screen md:overflow-y-auto">
//         <div className="max-w-md w-full text-center">
          
//           <button
//             onClick={() => router.push('/login')}
//             className="mb-6 text-gray-600 hover:text-red-800 flex items-center gap-2 font-medium"
//           >
//             <ArrowLeft className="w-4 h-4" /> Back to login
//           </button>

//           <h1 className="text-3xl font-bold text-gray-800 mb-4">
//             Faculty Registration Closed
//           </h1>

//           <p className="text-gray-600 text-lg bg-white border-2 border-gray-300 rounded-xl p-6 shadow-sm">
//             <strong>All faculty are already registered.</strong><br />
//             New registrations are currently disabled.
//           </p>

//         </div>
//       </div>
//     </div>
//   );
// }
