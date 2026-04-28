import crypto from 'node:crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import QRCode from 'qrcode';
import { Prisma, PrismaClient } from '@prisma/client';
import { createAttendanceWorkbook } from './utils/excelExport.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = [
  clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  }
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

function sanitizeOptional(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildAttendanceLink(token) {
  return `${clientUrl.replace(/\/$/, '')}/attend/${token}`;
}

function getTrainingStatus(training) {
  const now = new Date();
  const startsAt = new Date(training.startDateTime);
  const endsAt = new Date(training.endDateTime);

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

app.post('/api/trainings', asyncHandler(async (req, res) => {
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

app.get('/api/trainings', asyncHandler(async (req, res) => {
  const trainings = await prisma.training.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.json(trainings.map(trainingResponse));
}));

app.get('/api/trainings/:id', asyncHandler(async (req, res) => {
  const training = await prisma.training.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  if (!training) throw createHttpError(404, 'Training not found.');
  res.json(trainingResponse(training));
}));

app.get('/api/trainings/:id/qr', asyncHandler(async (req, res) => {
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

app.get('/api/trainings/:id/attendance', asyncHandler(async (req, res) => {
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

app.get('/api/trainings/:id/export', asyncHandler(async (req, res) => {
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
      token: true
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
    res.status(409).json({ error: 'You have already marked attendance for this training.' });
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
