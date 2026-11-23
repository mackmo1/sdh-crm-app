import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PropertyListPage } from './pages/PropertyListPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { PropertyFormPage } from './pages/PropertyFormPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadListPage } from './pages/LeadListPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadFormPage } from './pages/LeadFormPage';
import { ContactListPage } from './pages/ContactListPage';
import { ContactDetailPage } from './pages/ContactDetailPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { SiteVisitsPage } from './pages/SiteVisitsPage';
import { ReportsPage } from './pages/ReportsPage';
import { StaffPage } from './pages/StaffPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/properties" element={<PropertyListPage />} />
          <Route path="/properties/new" element={<PropertyFormPage mode="create" />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          <Route path="/properties/:id/edit" element={<PropertyFormPage mode="edit" />} />

          <Route path="/leads" element={<LeadListPage />} />
          <Route path="/leads/new" element={<LeadFormPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />

          <Route path="/contacts" element={<ContactListPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />

          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/site-visits" element={<SiteVisitsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/staff" element={<StaffPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
