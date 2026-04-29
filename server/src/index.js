import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { Prisma, PrismaClient } from '@prisma/client';
import { createAttendanceWorkbook } from './utils/excelExport.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const publicBaseUrl = process.env.PUBLIC_BASE_URL || clientUrl;

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://in-person-attendance-tracking.vercel.app'
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, 'JWT_SECRET is not configured.');
  }

  return process.env.JWT_SECRET;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: '12h' }
  );
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.get('authorization') || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw createHttpError(401, 'Authentication required.');
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user || user.status !== 'APPROVED') {
      throw createHttpError(401, 'Authentication required.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(createHttpError(401, 'Authentication required.'));
      return;
    }

    next(error);
  }
}

function requireMasterAdmin(req, res, next) {
  if (req.user?.role !== 'MASTER_ADMIN') {
    next(createHttpError(403, 'Master admin access required.'));
    return;
  }

  next();
}

function sanitizeOptional(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildAttendanceLink(token) {
  return `${publicBaseUrl.replace(/\/$/, '')}/attend/${token}`;
}

function getTrainingStatus(training) {
  const now = new Date();
  const startsAt = new Date(training.startDateTime);
  const endsAt = new Date(training.endDateTime);

  if (training.manuallyStopped) return 'closed';
  if (now < startsAt) return 'upcoming';
  if (now > endsAt) return 'expired';
  return 'open';
}

function trainingResponse(training) {
  return {
    ...training,
    attendanceLink: buildAttendanceLink(training.token),
    status: getTrainingStatus(training)
  };
}

async function generateUniqueToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(32).toString('hex');
    const existing = await prisma.training.findUnique({ where: { token } });
    if (!existing) return token;
  }

  throw createHttpError(500, 'Could not generate a unique attendance token.');
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'attendance-api',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username?.trim() || !password) {
    throw createHttpError(400, 'Username and password are required.');
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw createHttpError(400, 'Passwords do not match.');
  }

  if (password.length < 8) {
    throw createHttpError(400, 'Password must be at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      username: username.trim(),
      passwordHash,
      role: 'ADMIN',
      status: 'PENDING'
    }
  });

  res.status(201).json({
    message: 'Signup request submitted. Please wait for master admin approval.',
    user: publicUser(user)
  });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password) {
    throw createHttpError(400, 'Username and password are required.');
  }

  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user) {
    throw createHttpError(401, 'Invalid username or password.');
  }

  if (user.status === 'PENDING') {
    throw createHttpError(403, 'Your account is waiting for master admin approval.');
  }

  if (user.status === 'REJECTED') {
    throw createHttpError(403, 'Your signup request was rejected.');
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw createHttpError(401, 'Invalid username or password.');
  }

  res.json({
    token: signToken(user),
    user: publicUser(user)
  });
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/admin/users', requireAuth, requireMasterAdmin, asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json(users);
}));

app.get('/api/admin/pending-users', requireAuth, requireMasterAdmin, asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json(users);
}));

app.patch('/api/admin/users/:id/approve', requireAuth, requireMasterAdmin, asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED' }
  });

  res.json(publicUser(user));
}));

app.patch('/api/admin/users/:id/reject', requireAuth, requireMasterAdmin, asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    throw createHttpError(400, 'You cannot reject your own master admin account.');
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: 'REJECTED' }
  });

  res.json(publicUser(user));
}));

app.post('/api/trainings', requireAuth, asyncHandler(async (req, res) => {
  const {
    trainingName,
    trainerName,
    location,
    description,
    startDateTime,
    endDateTime
  } = req.body;

  if (!trainingName?.trim() || !trainerName?.trim() || !location?.trim() || !startDateTime || !endDateTime) {
    throw createHttpError(400, 'Training name, trainer, location, start time, and end time are required.');
  }

  const startsAt = new Date(startDateTime);
  const endsAt = new Date(endDateTime);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw createHttpError(400, 'Start and end date/time must be valid dates.');
  }

  if (startsAt >= endsAt) {
    throw createHttpError(400, 'End date/time must be after start date/time.');
  }

  const training = await prisma.training.create({
    data: {
      trainingName: trainingName.trim(),
      trainerName: trainerName.trim(),
      location: location.trim(),
      description: sanitizeOptional(description),
      startDateTime: startsAt,
      endDateTime: endsAt,
      token: await generateUniqueToken()
    },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.status(201).json(trainingResponse(training));
}));

app.get('/api/trainings', requireAuth, asyncHandler(async (req, res) => {
  const trainings = await prisma.training.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.json(trainings.map(trainingResponse));
}));

app.get('/api/trainings/:id', requireAuth, asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  if (!training) throw createHttpError(404, 'Training not found.');
  res.json(trainingResponse(training));
}));

app.get('/api/trainings/:id/qr', requireAuth, asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({ where: { id: req.params.id } });
  if (!training) throw createHttpError(404, 'Training not found.');

  const qrBuffer = await QRCode.toBuffer(buildAttendanceLink(training.token), {
    type: 'png',
    width: 960,
    margin: 2,
    errorCorrectionLevel: 'M'
  });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  res.send(qrBuffer);
}));

app.get('/api/trainings/:id/attendance', requireAuth, asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({ where: { id: req.params.id } });
  if (!training) throw createHttpError(404, 'Training not found.');

  const attendances = await prisma.attendance.findMany({
    where: { trainingId: req.params.id },
    orderBy: { employeeName: 'asc' },
    select: {
      employeeId: true,
      employeeName: true
    }
  });

  res.json(attendances);
}));

app.get('/api/trainings/:id/export', requireAuth, asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({
    where: { id: req.params.id },
    select: {
      trainingName: true,
      attendances: {
        orderBy: { employeeName: 'asc' },
        select: {
          employeeId: true,
          employeeName: true
        }
      }
    },
  });

  if (!training) throw createHttpError(404, 'Training not found.');

  const workbook = createAttendanceWorkbook(training.attendances);
  const safeName = training.trainingName.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');
  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${safeName}.xlsx"`);
  res.setHeader('Content-Length', buffer.byteLength);
  res.send(Buffer.from(buffer));
}));

app.patch('/api/trainings/:id/stop', requireAuth, asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  if (!training) throw createHttpError(404, 'Training not found.');
  if (training.manuallyStopped) {
    res.json(trainingResponse(training));
    return;
  }

  if (getTrainingStatus(training) !== 'open') {
    throw createHttpError(400, 'Only active trainings can be stopped.');
  }

  const stoppedTraining = await prisma.training.update({
    where: { id: req.params.id },
    data: {
      manuallyStopped: true,
      stoppedAt: new Date()
    },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.json(trainingResponse(stoppedTraining));
}));

app.delete('/api/trainings/:id', requireAuth, asyncHandler(async (req, res) => {
  await prisma.training.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

app.get('/api/attend/:token/status', asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({
    where: { token: req.params.token },
    select: {
      id: true,
      trainingName: true,
      trainerName: true,
      location: true,
      description: true,
      startDateTime: true,
      endDateTime: true,
      token: true,
      manuallyStopped: true,
      stoppedAt: true
    }
  });

  if (!training) throw createHttpError(404, 'Attendance link not found.');

  res.json({
    training: trainingResponse(training),
    serverTime: new Date().toISOString()
  });
}));

app.post('/api/attend/:token', asyncHandler(async (req, res) => {
  const { employeeId, employeeName } = req.body;

  if (!employeeId?.trim() || !employeeName?.trim()) {
    throw createHttpError(400, 'Employee ID and employee name are required.');
  }

  const training = await prisma.training.findUnique({ where: { token: req.params.token } });
  if (!training) throw createHttpError(404, 'Attendance link not found.');

  const status = getTrainingStatus(training);
  if (status === 'upcoming') throw createHttpError(403, 'Attendance has not opened yet.');
  if (status === 'closed') throw createHttpError(403, 'Attendance closed by admin.');
  if (status === 'expired') throw createHttpError(403, 'Attendance has closed for this training.');

  const attendance = await prisma.attendance.create({
    data: {
      trainingId: training.id,
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim()
    },
    select: {
      employeeId: true,
      employeeName: true
    }
  });

  res.status(201).json({
    message: 'Attendance submitted successfully.',
    attendance
  });
}));

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    const message = target.includes('username')
      ? 'Username already exists.'
      : 'You have already marked attendance for this training.';
    res.status(409).json({ error: message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    res.status(404).json({ error: 'Record not found.' });
    return;
  }

  const status = error.status || 500;
  const message = status === 500 ? 'Something went wrong. Please try again.' : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Attendance API listening on port ${port}`);
});
