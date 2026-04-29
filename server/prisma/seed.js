import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultUsers = [
  {
    username: 'Attendance@master',
    password: 'Password123',
    role: 'MASTER_ADMIN',
    status: 'APPROVED'
  },
  {
    username: 'Attendance@mavericks',
    password: 'Password123',
    role: 'ADMIN',
    status: 'APPROVED'
  },
  {
    username: 'Attendance@Laterals',
    password: 'Password123',
    role: 'ADMIN',
    status: 'APPROVED'
  },
  {
    username: 'Attendance@Sonic',
    password: 'Password123',
    role: 'ADMIN',
    status: 'APPROVED'
  }
];

async function main() {
  for (const user of defaultUsers) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        role: user.role,
        status: user.status
      },
      create: {
        username: user.username,
        passwordHash,
        role: user.role,
        status: user.status
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
