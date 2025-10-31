// scripts/create-faculty.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createFaculty() {
  try {
    console.log('🔧 Creating faculty account...\n');

    // You can customize these values
    const email = 'admin@example.com';
    const password = 'admin123';
    const name = 'Admin Faculty';

    // Check if faculty already exists
    const existingFaculty = await prisma.user.findUnique({
      where: { email }
    });

    if (existingFaculty) {
      console.log('⚠️  Faculty account already exists with email:', email);
      console.log('Email:', existingFaculty.email);
      console.log('Name:', existingFaculty.name);
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the faculty user
    const faculty = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'FACULTY',
      },
    });

    console.log('✅ Faculty account created successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('🆔 ID:', faculty.id);
    console.log('\n🎉 You can now login at http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Error creating faculty account:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createFaculty();