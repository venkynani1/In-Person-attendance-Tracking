import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import QRCode from 'qrcode';
import XLSX from 'xlsx';
import { Prisma, PrismaClient } from '@prisma/client';
import { createAttendanceWorkbook } from './utils/excelExport.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const publicBaseUrl = process.env.PUBLIC_BASE_URL || clientUrl;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) {
      callback(null, true);
      return;
    }

    const error = createHttpError(400, 'Please upload an Excel file with .xlsx or .xls extension.');
    callback(error);
  }
});
let nominationTableReadyPromise = null;
let trainingOwnershipReadyPromise = null;
let passwordResetColumnsReadyPromise = null;
let attendanceIpAddressReadyPromise = null;

const allowedOrigins = [
  'https://in-person-attendance-tracking.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeCell(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function readNominationCell(row, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  let matchedValue = '';

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeHeader(key))) {
      const cellValue = normalizeCell(value);
      if (cellValue) return cellValue;
      matchedValue = cellValue;
    }
  }

  return matchedValue;
}

function parseNominationsWorkbook(buffer) {
  let workbook;

  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      raw: false
    });
  } catch (error) {
    throw createHttpError(400, 'Could not read the Excel file.');
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw createHttpError(400, 'The Excel file does not contain any sheets.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: '',
    raw: false
  });

  const nominationsByEmployeeId = new Map();
  const employeeIdHeaders = ['Employee ID', 'EMP_ID', 'Emp ID', 'employeeId'];
  const employeeNameHeaders = ['Employee Name', 'EMP_NAME', 'Name', 'employeeName'];

  rows.forEach((row, index) => {
    const employeeId = readNominationCell(row, employeeIdHeaders);
    const employeeName = readNominationCell(row, employeeNameHeaders);

    if (!employeeId && !employeeName) return;

    if (!employeeId || !employeeName) {
      throw createHttpError(400, `Row ${index + 2} must include Employee ID and Employee Name.`);
    }

    nominationsByEmployeeId.set(employeeId, {
      employeeId,
      employeeName
    });
  });

  const nominations = [...nominationsByEmployeeId.values()];
  if (nominations.length === 0) {
    throw createHttpError(400, 'No nominations were found in the Excel file.');
  }

  return nominations;
}

function buildExportRows(nominations = [], attendances = []) {
  const attendanceByEmployeeId = new Map(
    attendances.map((attendance) => [attendance.employeeId, attendance])
  );
  const nominationByEmployeeId = new Map(
    nominations.map((nomination) => [nomination.employeeId, nomination])
  );

  const nominatedRows = nominations.map((nomination) => ({
    employeeId: nomination.employeeId,
    employeeName: nomination.employeeName,
    status: attendanceByEmployeeId.has(nomination.employeeId) ? 'Present' : 'Absent'
  }));

  const extraAttendanceRows = attendances
    .filter((attendance) => !nominationByEmployeeId.has(attendance.employeeId))
    .map((attendance) => ({
      employeeId: attendance.employeeId,
      employeeName: attendance.employeeName,
      status: 'Present'
    }));

  return [...nominatedRows, ...extraAttendanceRows];
}

function isMissingNominationTableError(error) {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2010' &&
    error.meta?.code === '42P01';
}

function getRequestIp(req) {
  const forwardedFor = Array.isArray(req.headers['x-forwarded-for'])
    ? req.headers['x-forwarded-for'].join(',')
    : req.headers['x-forwarded-for'];
  const rawIp =
    (forwardedFor || '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean)[0] ||
    req.socket.remoteAddress ||
    'unknown';

  const ipAddress = rawIp.replace('::ffff:', '');
  return ipAddress;
}

function isMasterAdmin(user) {
  return user?.role === 'MASTER_ADMIN';
}

function trainingVisibilityWhere(user) {
  if (isMasterAdmin(user)) return {};
  return { createdById: user.id };
}

function assertTrainingAccess(training, user) {
  if (isMasterAdmin(user)) return;

  if (training.createdById !== user.id) {
    throw createHttpError(403, 'You do not have access to this training.');
  }
}

async function ensureTrainingOwnershipColumn() {
  if (!trainingOwnershipReadyPromise) {
    trainingOwnershipReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "createdById" UUID;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Training_createdById_idx" ON "Training"("createdById");
      `);
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'Training_createdById_fkey'
          ) THEN
            ALTER TABLE "Training"
            ADD CONSTRAINT "Training_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "users"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
    })().catch((error) => {
      trainingOwnershipReadyPromise = null;
      throw error;
    });
  }

  return trainingOwnershipReadyPromise;
}

async function getTrainingOrThrow(id, user, options = {}) {
  await ensureTrainingOwnershipColumn();

  const queryOptions = options.select
    ? { ...options, select: { ...options.select, createdById: true } }
    : options;

  const training = await prisma.training.findUnique({
    where: { id },
    ...queryOptions
  });

  if (!training) throw createHttpError(404, 'Training not found.');

  assertTrainingAccess(training, user);
  return training;
}

async function requireTrainingAccess(req, res, next) {
  try {
    req.training = await getTrainingOrThrow(req.params.id, req.user);
    next();
  } catch (error) {
    next(error);
  }
}

async function ensureNominationTable() {
  if (!nominationTableReadyPromise) {
    nominationTableReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Nomination" (
          "id" UUID NOT NULL,
          "trainingId" UUID NOT NULL,
          "employeeId" TEXT NOT NULL,
          "employeeName" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Nomination_trainingId_employeeId_key"
        ON "Nomination"("trainingId", "employeeId");
      `);
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'Nomination_trainingId_fkey'
          ) THEN
            ALTER TABLE "Nomination"
            ADD CONSTRAINT "Nomination_trainingId_fkey"
            FOREIGN KEY ("trainingId") REFERENCES "Training"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
    })().catch((error) => {
      nominationTableReadyPromise = null;
      throw error;
    });
  }

  return nominationTableReadyPromise;
}

async function ensureAttendanceIpAddressColumn() {
  if (!attendanceIpAddressReadyPromise) {
    attendanceIpAddressReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
      `);
    })().catch((error) => {
      attendanceIpAddressReadyPromise = null;
      throw error;
    });
  }

  return attendanceIpAddressReadyPromise;
}

async function getNominationCounts(trainingIds) {
  if (trainingIds.length === 0) return new Map();

  try {
    const rows = await prisma.$queryRaw`
      SELECT "trainingId"::text AS "trainingId", COUNT(*)::int AS "count"
      FROM "Nomination"
      WHERE "trainingId"::text IN (${Prisma.join(trainingIds)})
      GROUP BY "trainingId"
    `;

    return new Map(rows.map((row) => [row.trainingId, Number(row.count)]));
  } catch (error) {
    if (isMissingNominationTableError(error)) {
      return new Map();
    }

    throw error;
  }
}

async function trainingResponses(trainings) {
  const nominationCounts = await getNominationCounts(trainings.map((training) => training.id));
  return trainings.map((training) => trainingResponse(
    training,
    nominationCounts.get(training.id) || 0
  ));
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

function assertApprovedForPasswordReset(user) {
  if (user.status === 'PENDING') {
    throw createHttpError(403, 'Your account is waiting for master admin approval.');
  }

  if (user.status === 'REJECTED') {
    throw createHttpError(403, 'Your signup request was rejected.');
  }

  if (user.status !== 'APPROVED') {
    throw createHttpError(403, 'Only approved users can reset password.');
  }
}

async function ensurePasswordResetColumns() {
  if (!passwordResetColumnsReadyPromise) {
    passwordResetColumnsReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetTokenExpires" TIMESTAMP(3);
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_resetToken_key" ON "users"("resetToken");
      `);
    })().catch((error) => {
      passwordResetColumnsReadyPromise = null;
      throw error;
    });
  }

  return passwordResetColumnsReadyPromise;
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

function trainingResponse(training, nominatedCount = 0) {
  return {
    ...training,
    attendanceLink: buildAttendanceLink(training.token),
    status: getTrainingStatus(training),
    nominatedCount
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
  await ensurePasswordResetColumns();

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
  await ensurePasswordResetColumns();

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

app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
  await ensurePasswordResetColumns();

  const { username } = req.body;

  if (!username?.trim()) {
    throw createHttpError(400, 'Username is required.');
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
    select: {
      username: true,
      status: true
    }
  });

  if (!user) {
    throw createHttpError(404, 'User not found');
  }

  assertApprovedForPasswordReset(user);

  const token = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { username: user.username },
    data: {
      resetToken: token,
      resetTokenExpires
    }
  });

  res.json({
    token
  });
}));

app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
  await ensurePasswordResetColumns();

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw createHttpError(400, 'Invalid or expired token');
  }

  if (newPassword.length < 6) {
    throw createHttpError(400, 'Password must be at least 6 characters.');
  }

  const user = await prisma.user.findUnique({
    where: { resetToken: token },
    select: {
      id: true,
      status: true,
      resetTokenExpires: true
    }
  });

  if (!user) {
    throw createHttpError(400, 'Invalid or expired token');
  }

  if (!user.resetTokenExpires || user.resetTokenExpires <= new Date()) {
    throw createHttpError(400, 'Invalid or expired token');
  }

  assertApprovedForPasswordReset(user);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null
    }
  });

  res.json({
    message: 'Password updated successfully. Please login.'
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
  await ensureTrainingOwnershipColumn();

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
      createdById: req.user.id,
      token: await generateUniqueToken()
    },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.status(201).json(trainingResponse(training));
}));

app.get('/api/trainings', requireAuth, asyncHandler(async (req, res) => {
  await ensureTrainingOwnershipColumn();

  const trainings = await prisma.training.findMany({
    where: trainingVisibilityWhere(req.user),
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.json(await trainingResponses(trainings));
}));

app.get('/api/trainings/:id', requireAuth, asyncHandler(async (req, res) => {
  const training = await getTrainingOrThrow(req.params.id, req.user, {
    include: {
      _count: { select: { attendances: true } }
    }
  });

  res.json((await trainingResponses([training]))[0]);
}));

app.get('/api/trainings/:id/qr', requireAuth, asyncHandler(async (req, res) => {
  const training = await getTrainingOrThrow(req.params.id, req.user);

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
  await getTrainingOrThrow(req.params.id, req.user);

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

app.get('/api/trainings/:id/nominations', requireAuth, asyncHandler(async (req, res) => {
  await getTrainingOrThrow(req.params.id, req.user);
  await ensureNominationTable();

  const nominations = await prisma.nomination.findMany({
    where: { trainingId: req.params.id },
    orderBy: [
      { employeeName: 'asc' },
      { employeeId: 'asc' }
    ],
    select: {
      employeeId: true,
      employeeName: true
    }
  });

  res.json(nominations);
}));

app.post('/api/trainings/:id/nominations', requireAuth, requireTrainingAccess, upload.single('nominationsFile'), asyncHandler(async (req, res) => {
  await ensureNominationTable();

  if (!req.file) {
    throw createHttpError(400, 'Please select a nominations Excel file.');
  }

  const nominations = parseNominationsWorkbook(req.file.buffer);

  await prisma.$transaction(
    nominations.map((nomination) =>
      prisma.nomination.upsert({
        where: {
          trainingId_employeeId: {
            trainingId: req.params.id,
            employeeId: nomination.employeeId
          }
        },
        update: {
          employeeName: nomination.employeeName
        },
        create: {
          trainingId: req.params.id,
          employeeId: nomination.employeeId,
          employeeName: nomination.employeeName
        }
      })
    )
  );

  const nominatedCount = await prisma.nomination.count({
    where: { trainingId: req.params.id }
  });

  res.json({
    message: 'Nominations uploaded successfully',
    uploadedCount: nominations.length,
    nominatedCount
  });
}));

app.get('/api/trainings/:id/export', requireAuth, asyncHandler(async (req, res) => {
  await getTrainingOrThrow(req.params.id, req.user);
  await ensureNominationTable();

  const training = await prisma.training.findUnique({
    where: { id: req.params.id },
    select: {
      trainingName: true,
      startDateTime: true,
      attendances: {
        orderBy: [
          { employeeName: 'asc' },
          { employeeId: 'asc' }
        ],
        select: {
          employeeId: true,
          employeeName: true
        }
      },
      nominations: {
        orderBy: [
          { employeeName: 'asc' },
          { employeeId: 'asc' }
        ],
        select: {
          employeeId: true,
          employeeName: true
        }
      }
    },
  });

  if (!training) throw createHttpError(404, 'Training not found.');

  const workbook = createAttendanceWorkbook(buildExportRows(training.nominations, training.attendances), {
    trainingDate: training.startDateTime,
    includeStatus: true
  });
  const safeName = training.trainingName.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');
  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${safeName}.xlsx"`);
  res.setHeader('Content-Length', buffer.byteLength);
  res.send(Buffer.from(buffer));
}));

app.patch('/api/trainings/:id/stop', requireAuth, asyncHandler(async (req, res) => {
  const training = await getTrainingOrThrow(req.params.id, req.user, {
    include: {
      _count: { select: { attendances: true } }
    }
  });

  if (training.manuallyStopped) {
    res.json((await trainingResponses([training]))[0]);
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

  res.json((await trainingResponses([stoppedTraining]))[0]);
}));

app.delete('/api/trainings/:id', requireAuth, asyncHandler(async (req, res) => {
  await getTrainingOrThrow(req.params.id, req.user);
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
  await ensureAttendanceIpAddressColumn();

  const { employeeId, employeeName } = req.body;
  const normalizedEmployeeId = String(employeeId || '').trim();
  const normalizedEmployeeName = String(employeeName || '').trim();
  const ipAddress = getRequestIp(req);

  if (!normalizedEmployeeId || !normalizedEmployeeName) {
    throw createHttpError(400, 'Employee ID and employee name are required.');
  }

  if (!/^[0-9]{10}$/.test(normalizedEmployeeId)) {
    throw createHttpError(400, 'Invalid Employee ID format');
  }

  const training = await prisma.training.findUnique({
    where: { token: req.params.token },
    select: {
      id: true,
      startDateTime: true,
      endDateTime: true,
      manuallyStopped: true
    }
  });
  if (!training) throw createHttpError(404, 'Attendance link not found.');

  const status = getTrainingStatus(training);
  if (status === 'upcoming') throw createHttpError(403, 'Attendance has not opened yet.');
  if (status === 'closed') throw createHttpError(403, 'Attendance closed by admin.');
  if (status === 'expired') throw createHttpError(403, 'Attendance has closed for this training.');

  if (ipAddress) {
    const existingAttendanceFromIp = await prisma.attendance.findFirst({
      where: {
        trainingId: training.id,
        ipAddress
      },
      select: {
        id: true
      }
    });

    if (existingAttendanceFromIp) {
      throw createHttpError(400, 'Attendance already submitted from this device');
    }
  }

  const attendance = await prisma.attendance.create({
    data: {
      trainingId: training.id,
      employeeId: normalizedEmployeeId,
      employeeName: normalizedEmployeeName,
      ipAddress
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
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Nominations file must be 8 MB or smaller.'
      : 'Could not upload nominations file.';
    res.status(400).json({ error: message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    const message = target.includes('username')
      ? 'Username already exists.'
      : 'Attendance already submitted';
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
