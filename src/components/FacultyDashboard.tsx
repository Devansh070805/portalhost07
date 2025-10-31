// src/components/FacultyDashboard.tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This component needs to be async to fetch data from the database
export default async function FacultyDashboard({ user }: { user: { id: string, name?: string | null } }) {

  // You will fetch the faculty's subgroups here later
  const subgroups = await prisma.subgroup.findMany({
    where: {
      facultyId: user.id,
    },
    include: {
      teams: true, // Also include the teams within each subgroup
    },
  });

  return (
    <div>
      <h1>Faculty Dashboard</h1>
      <p>Welcome, {user.name || 'Faculty Member'}!</p>

      <h2>Your Subgroups:</h2>
      {subgroups.length > 0 ? (
        <ul>
          {subgroups.map((subgroup) => (
            <li key={subgroup.id}>
              <strong>{subgroup.name}</strong> ({subgroup.teams.length} teams)
            </li>
          ))}
        </ul>
      ) : (
        <p>You are not assigned to any subgroups yet.</p>
      )}
    </div>
  );
}