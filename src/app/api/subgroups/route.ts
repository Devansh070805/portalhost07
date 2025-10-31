// src/app/api/subgroups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all subgroups
export async function GET(req: NextRequest) {
  try {
    const subgroups = await prisma.subgroup.findMany({
      include: {
        faculty: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teams: {
          include: {
            leader: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            project: true,
          },
        },
      },
    });

    return NextResponse.json({ subgroups });
  } catch (error) {
    console.error('Get subgroups error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST create new subgroup
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, facultyId } = body;

    if (!name || !facultyId) {
      return NextResponse.json(
        { error: 'Name and faculty ID are required' },
        { status: 400 }
      );
    }

    const subgroup = await prisma.subgroup.create({
      data: {
        name,
        facultyId,
      },
      include: {
        faculty: true,
      },
    });

    return NextResponse.json({
      subgroup,
      message: 'Subgroup created successfully',
    });
  } catch (error) {
    console.error('Create subgroup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}