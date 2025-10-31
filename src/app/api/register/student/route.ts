// src/app/api/register/student/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, teamName, subgroup, members } = await req.json();

    if (!name || !email || !password || !teamName || !subgroup) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Check if team name already exists
    const existingTeam = await prisma.team.findUnique({
      where: { name: teamName }
    });

    if (existingTeam) {
      return NextResponse.json(
        { error: 'Team name already taken' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Find or create subgroup
    let subgroupRecord = await prisma.subgroup.findFirst({
      where: { name: subgroup }
    });

    // Create user and team in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user (team leader)
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.TEAM_MEMBER,
          teamName,
          subgroup,
        },
      });

      // Create the team
      const newTeam = await tx.team.create({
        data: {
          name: teamName,
          leaderId: newUser.id,
          subgroupId: subgroupRecord?.id,
          members: members || [name], // Include leader by default
        },
      });

      return { user: newUser, team: newTeam };
    });

    const { password: _, ...userWithoutPassword } = result.user;

    return NextResponse.json({
      user: userWithoutPassword,
      team: result.team,
      message: 'Registration successful!'
    });

  } catch (error) {
    console.error('Error registering student:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}