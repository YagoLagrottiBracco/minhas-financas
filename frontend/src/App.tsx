import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@chakra-ui/react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import DashboardPage from './pages/Dashboard';
import GroupsPage from './pages/Groups';
import GroupDetailPage from './pages/GroupDetail';
import EnvironmentBillsPage from './pages/EnvironmentBills';
import HistoryPage from './pages/History';
import NotificationsPage from './pages/Notifications';
import MainLayout from './components/layout/MainLayout';

const App = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Box p={8}>Carregando...</Box>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            <MainLayout>
              <DashboardPage />
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/groups"
        element={
          isAuthenticated ? (
            <MainLayout>
              <GroupsPage />
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/groups/:groupId"
        element={
          isAuthenticated ? (
            <MainLayout>
              <GroupDetailPage />
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/groups/:groupId/environments/:environmentId"
        element={
          isAuthenticated ? (
            <MainLayout>
              <EnvironmentBillsPage />
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/history"
        element={
          isAuthenticated ? (
            <MainLayout>
              <HistoryPage />
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/notifications"
        element={
          isAuthenticated ? (
            <MainLayout>
              <NotificationsPage />
            </MainLayout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
};

export default App;
