import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PropertyListPage } from './pages/PropertyListPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { PropertyFormPage } from './pages/PropertyFormPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/properties" replace />} />
          <Route path="/properties" element={<PropertyListPage />} />
          <Route path="/properties/new" element={<PropertyFormPage mode="create" />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          <Route path="/properties/:id/edit" element={<PropertyFormPage mode="edit" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
