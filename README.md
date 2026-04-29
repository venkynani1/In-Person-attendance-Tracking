# In-Person Attendance Tracking

Full-stack attendance app for in-person trainings.

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL with Prisma
- Hosted database: Supabase
- Excel export: exceljs
- QR codes: qrcode
- Auth: JWT + bcrypt password hashing

## Project Structure

```text
root/
  client/
  server/
```

## Local Setup

### 1. Configure the backend

Create a Supabase PostgreSQL database, copy the PostgreSQL connection string, and put it in `server/.env`.

```bash
cd server
cp .env.example .env
```

Set:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-SUPABASE-HOST]:5432/postgres?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
CLIENT_URL="http://localhost:5173"
PUBLIC_BASE_URL="http://localhost:5173"
PORT=5000
```

### 2. Configure the frontend

Create `client/.env`:

```env
VITE_API_BASE_URL="http://localhost:5000"
```

### 3. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 4. Create database tables and seed users

```bash
cd server
npx prisma generate
npx prisma db push
npx prisma db seed
```

The seed is idempotent. Existing default users are not duplicated, and their role/status are kept aligned.

### 5. Run locally

Terminal 1:

```bash
cd server
npm run dev
```

Terminal 2:

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

## Default Login Credentials

Master admin:

```text
username: Attendance@master
password: Password123
```

Default admins:

```text
username: Attendance@mavericks
password: Password123

username: Attendance@Laterals
password: Password123

username: Attendance@Sonic
password: Password123
```

New signups are created as `ADMIN` users with `PENDING` status. Only the master admin can approve or reject them.

## API Endpoints

Public:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/attend/:token/status`
- `POST /api/attend/:token`

Protected:

- `GET /api/auth/me`
- `POST /api/trainings`
- `GET /api/trainings`
- `GET /api/trainings/:id`
- `GET /api/trainings/:id/qr`
- `GET /api/trainings/:id/attendance`
- `GET /api/trainings/:id/export`
- `PATCH /api/trainings/:id/stop`
- `DELETE /api/trainings/:id`

Master admin only:

- `GET /api/admin/users`
- `GET /api/admin/pending-users`
- `PATCH /api/admin/users/:id/approve`
- `PATCH /api/admin/users/:id/reject`

Protected requests require:

```text
Authorization: Bearer <token>
```

## Render Free Wake-Up Handling

Render Free services can sleep after inactivity. This app includes:

- Backend health endpoint at `GET /api/health`
- Frontend startup health check
- Retry handling for transient network, `502`, `503`, and `504` failures
- Clear banner and loading messages while the backend is waking up

## Deployment

### Backend on Render

1. Create a new Render Web Service from this repo.
2. Set root directory to `server`.
3. Build command:

```bash
npm install && npx prisma generate && npx prisma db push && npx prisma db seed
```

4. Start command:

```bash
npm start
```

5. Add environment variables:

```env
DATABASE_URL="your Supabase PostgreSQL URL"
JWT_SECRET="long production secret"
CLIENT_URL="https://your-vercel-app.vercel.app"
PUBLIC_BASE_URL="https://your-vercel-app.vercel.app"
NODE_ENV="production"
PORT=10000
```

### Frontend on Vercel

1. Create a new Vercel project from this repo.
2. Set root directory to `client`.
3. Build command:

```bash
npm run build
```

4. Output directory:

```text
dist
```

5. Add environment variable:

```env
VITE_API_BASE_URL="https://your-render-service.onrender.com"
```

After deploying Vercel, update Render's `CLIENT_URL` and `PUBLIC_BASE_URL` to the final Vercel URL.

## Notes

- Dashboard routes require login.
- Participant attendance routes remain public for QR scanning.
- Attendance submission is accepted only while the session is active.
- Manual stop immediately closes attendance and shows participants that attendance was closed by admin.
- Each employee can submit once per training because of the `trainingId + employeeId` unique constraint.
- Excel export includes `Training Date`, `Employee ID`, and `Employee Name`. If nomination/status rows are exported in the future, `Status` is included as the final column.
