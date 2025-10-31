'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthCheckProps {
  children: React.ReactNode;
  requiredRole: 'student' | 'faculty';
  requiredStudentType?: 'LEADER' | 'MEMBER'; // <<< ADD THIS NEW PROP
}

export default function AuthCheck({ children, requiredRole, requiredStudentType }: AuthCheckProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Get all items from localStorage
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    const userType = localStorage.getItem('userType'); // 'student' or 'faculty'
    const studentType = localStorage.getItem('studentType'); // 'LEADER' or 'MEMBER'

    // 1. Check if logged in
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // 2. Check if the role is correct (student vs faculty)
    if (userType !== requiredRole) {
      // Wrong role, send them to their own dashboard
      router.push(userType === 'faculty' ? '/faculty/dashboard' : '/dashboard');
      return;
    }

    // 3. <<< ADD THIS NEW CHECK >>>
    // If a specific student type is required, check for it
    if (requiredStudentType && studentType !== requiredStudentType) {
      // e.g., a 'MEMBER' tries to access this 'LEADER' page
      // Send them back to their dashboard
      router.push('/dashboard'); 
      return;
    }

    // If all checks pass, show the page
    setIsAuthorized(true);

  }, [router, requiredRole, requiredStudentType]);

  if (!isAuthorized) {
    // You can return a loading spinner here
    return <div>Loading...</div>; // Or a proper loading component
  }

  // Render the protected page content
  return <>{children}</>;
}