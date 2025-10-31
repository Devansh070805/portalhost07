// src/components/Header.tsx
'use client';

import { Code, Menu, User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface HeaderProps {
  title: string;
  userRole: string;
}

export default function Header({ title, userRole }: HeaderProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // 🔹 Load username & email from localStorage
  useEffect(() => {
    const storedName = localStorage.getItem('userName') || 'User';
    const storedEmail = localStorage.getItem('userEmail') || 'example@email.com';
    setUserName(storedName);
    setUserEmail(storedEmail);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <header className="bg-red-800 shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Left side: Title + Logo */}
        <div className="flex items-center gap-3">
          <button className="lg:hidden" onClick={() => setShowMenu(!showMenu)}>
            <Menu className="w-6 h-6 text-white" />
          </button>
          <Code className="w-8 h-8 text-white" />
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>

        {/* Right side: User Section */}
        <div className="flex items-center gap-4">
          <span className="text-white hidden md:block capitalize">{userRole}</span>

          <div className="relative">
            {/* Profile Button */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-10 h-10 bg-gray-800 hover:bg-gray-900 rounded-full flex items-center justify-center transition-colors"
            >
              <User className="w-5 h-5 text-white" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50 animate-fadeIn">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-600 truncate">{userEmail}</p>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full px-5 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-gray-600" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optional: click outside to close dropdown */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        ></div>
      )}
    </header>
  );
}
