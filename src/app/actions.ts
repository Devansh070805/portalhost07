'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createSessionAndRedirect(
  userData: { 
    email: string | null; 
    name: string; 
    teamId?: string; 
    role: string; 
    studentType?: string;
  }, 
  destination: string
) {
  const cookieStore = await cookies();
  const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Set cookies safely on the server
  cookieStore.set('userEmail', userData.email || '', { path: '/', maxAge: oneWeek, sameSite: 'lax' });
  cookieStore.set('userName', userData.name || '', { path: '/', maxAge: oneWeek, sameSite: 'lax' });
  cookieStore.set('userType', userData.role, { path: '/', maxAge: oneWeek, sameSite: 'lax' });
  
  if (userData.teamId) {
    cookieStore.set('teamId', userData.teamId, { path: '/', maxAge: oneWeek, sameSite: 'lax' });
  }

  // Redirect on the server side
  // This guarantees the next request (for the dashboard) has the cookies attached
  redirect(destination);
}