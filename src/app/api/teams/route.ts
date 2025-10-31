// src/app/api/teams/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all teams
export async function GET(req: NextRequest) {
  try {
    const teams = await prisma.team.findMany({
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        subgroup: true,
        project: true,
      },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Get teams error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}