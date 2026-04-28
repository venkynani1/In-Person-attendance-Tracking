# In-Person Attendance Tracking

Full-stack attendance app for in-person trainings.

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL with Prisma
- Excel export: exceljs
- QR codes: qrcode
- Token generation: Node crypto

## Project Structure

```text
root/
  client/
  server/
```

## Local Setup

### 1. Create a Supabase PostgreSQL database

Create a Supabase project, copy the pooled or direct PostgreSQL connection string, and put it in `server/.env`.

```bash
cd server
cp .env.example .env
```

Set:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-SUPABASE-HOST]:5432/postgres?schema=public"
CLIENT_URL="http://localhost:5173"
PORT=4000
```

### 2. Configure the frontend

```bash
cd client
cp .env.example .env
```

Set:

```env
VITE_API_BASE_URL="http://localhost:4000"
```

### 3. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 4. Create database tables

```bash
cd server
npx prisma migrate dev --name init
```

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

## API Endpoints

- `GET /api/health`
- `POST /api/trainings`
- `GET /api/trainings`
- `GET /api/trainings/:id`
- `GET /api/trainings/:id/qr`
- `GET /api/trainings/:id/attendance`
- `GET /api/trainings/:id/export`
- `GET /api/attend/:token/status`
- `POST /api/attend/:token`

## Render Free Wake-Up Handling

Render Free services can sleep after inactivity. This app includes:

- Backend health endpoint at `GET /api/health`
- Frontend startup health check
- Retry handling for transient network, `502`, `503`, and `504` failures
- Clear banner and loading messages while the backend is waking up

## Deployment

### Backend on Render Free

1. Create a new Render Web Service from this repo.
2. Set root directory to `server`.
3. Build command:

```bash
npm install && npm run build && npm run prisma:deploy
```

4. Start command:

```bash
npm start
```

5. Add environment variables:

```env
DATABASE_URL="your Supabase PostgreSQL URL"
CLIENT_URL="https://your-vercel-app.vercel.app"
NODE_ENV="production"
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

After deploying Vercel, update Render's `CLIENT_URL` to the final Vercel URL.

## Notes

- Attendance submission is only accepted between `startDateTime` and `endDateTime`.
- The public attendance form closes automatically after expiry by polling status.
- Each employee can submit once per training because of the `trainingId + employeeId` unique constraint.
