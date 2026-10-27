import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MentorDashboard } from './pages/MentorDashboard';
import { ClassManagement } from './pages/ClassManagement';
import { StudentDirectory } from './pages/StudentDirectory';
import { StudentProfileView } from './pages/StudentProfileView';
import { DailyProgressFeed } from './pages/DailyProgressFeed';
import { WeeklyReportsPage } from './pages/WeeklyReportsPage';
import { StudentProfileEdit } from './pages/StudentProfileEdit';
import { StudentClassesPage } from './pages/StudentClassesPage';
import { InviteRegistrationPage } from './pages/InviteRegistrationPage';
import { AuthPage } from './pages/AuthPage';
import { AlertCircle } from 'lucide-react';

const RootRedirect: React.FC = () => {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/auth" replace />;
  if (currentUser.role === 'mentor') return <Navigate to="/mentor/dashboard" replace />;
  return <Navigate to="/student/feed" replace />;
};

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

const NotFoundPage: React.FC = () => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center space-y-3 shadow-md">
      <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
      <h1 className="text-xl font-bold text-navy-950">Page Not Found</h1>
      <p className="text-xs text-slate-500">The requested page does not exist or has been moved.</p>
      <a
        href="/"
        className="inline-block mt-4 px-4 py-2 bg-navy-900 text-white rounded-xl text-xs font-semibold"
      >
        Return to Home
      </a>
    </div>
  </div>
);

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public invitation registration route */}
          <Route path="/invite/:inviteCode" element={<InviteRegistrationPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Mentor Routes */}
          <Route
            path="/mentor/dashboard"
            element={
              <ProtectedLayout>
                <MentorDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/mentor/classes"
            element={
              <ProtectedLayout>
                <ClassManagement />
              </ProtectedLayout>
            }
          />
          <Route
            path="/mentor/students"
            element={
              <ProtectedLayout>
                <StudentDirectory />
              </ProtectedLayout>
            }
          />
          <Route
            path="/mentor/students/:studentId"
            element={
              <ProtectedLayout>
                <StudentProfileView />
              </ProtectedLayout>
            }
          />
          <Route
            path="/mentor/feed"
            element={
              <ProtectedLayout>
                <DailyProgressFeed />
              </ProtectedLayout>
            }
          />
          <Route
            path="/mentor/weekly-reports"
            element={
              <ProtectedLayout>
                <WeeklyReportsPage />
              </ProtectedLayout>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student/feed"
            element={
              <ProtectedLayout>
                <DailyProgressFeed />
              </ProtectedLayout>
            }
          />
          <Route
            path="/student/weekly-reports"
            element={
              <ProtectedLayout>
                <WeeklyReportsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedLayout>
                <StudentProfileEdit />
              </ProtectedLayout>
            }
          />
          <Route
            path="/student/classes"
            element={
              <ProtectedLayout>
                <StudentClassesPage />
              </ProtectedLayout>
            }
          />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
