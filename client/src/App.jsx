import { Navigate, Route, Routes } from 'react-router-dom';
import BackendWakeBanner from './components/BackendWakeBanner.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AttendPage from './pages/AttendPage.jsx';
import CreateTraining from './pages/CreateTraining.jsx';
import QrDisplay from './pages/QrDisplay.jsx';
import TrainingDetails from './pages/TrainingDetails.jsx';

function App() {
  return (
    <>
      <BackendWakeBanner />
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/create" element={<CreateTraining />} />
        <Route path="/training/:id" element={<TrainingDetails />} />
        <Route path="/training/:id/qr-display" element={<QrDisplay />} />
        <Route path="/attend/:token" element={<AttendPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
