// src/actions/projects.ts
'use server';

import { z } from 'zod'; // <-- Import Zod
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// 1. Define the validation schema for your form
const ProjectSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters long.' }),
  description: z.string().min(20, { message: 'Description must be at least 20 characters long.' }),
  projectLink: z.string().url({ message: 'Please provide a valid URL.' }),
});

// The enhanced server action
export async function submitProject(formData: FormData) {
  const session = await getServerSession(authOptions);

  // Authentication & Authorization Check
  if (!session?.user?.id || session.user.role !== 'TEAM_LEADER') {
    return { error: 'Unauthorized' };
  }

  // 2. Validate the form data against the schema
  const rawFormData = {
    title: formData.get('title'),
    description: formData.get('description'),
    projectLink: formData.get('projectLink'),
  };

  const validationResult = ProjectSchema.safeParse(rawFormData);

  // If validation fails, return the errors to the UI
  if (!validationResult.success) {
    return {
      error: 'Invalid input. Please check the fields.',
      // .flatten() makes the error object easier to work with on the frontend
      issues: validationResult.error.flatten().fieldErrors, 
    };
  }

  // Get User's Team ID
  const userWithTeam = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { teamId: true },
  });

  if (!userWithTeam?.teamId) {
    return { error: 'You are not assigned to a team.' };
  }

  // 3. Use the validated data to create the project in the database
  try {
    await prisma.project.create({
      data: {
        title: validationResult.data.title,
        description: validationResult.data.description,
        project_link: validationResult.data.projectLink,
        teamId: userWithTeam.teamId,
      },
    });
  } catch (dbError) {
    return { error: 'Failed to save the project to the database.' };
  }

  // Revalidate the dashboard path to show the new data immediately
  revalidatePath('/dashboard');

  return { success: 'Project submitted successfully!' };
}