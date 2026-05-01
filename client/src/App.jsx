import { Navigate, Route, Routes } from 'react-router-dom';
import BackendWakeBanner from './components/BackendWakeBanner.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AttendPage from './pages/AttendPage.jsx';
import CreateTraining from './pages/CreateTraining.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import LoginPage from './pages/LoginPage.jsx';
import QrDisplay from './pages/QrDisplay.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import SignupPage from './pages/SignupPage.jsx';
import TrainingDetails from './pages/TrainingDetails.jsx';

function App() {
  return (
    <>
      <BackendWakeBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/attend/:token" element={<AttendPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/create" element={<CreateTraining />} />
          <Route path="/training/:id" element={<TrainingDetails />} />
          <Route path="/training/:id/qr-display" element={<QrDisplay />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
