import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GuestOnly, ProtectedRoute } from './components/ProtectedRoute';
import Account from './pages/Account';
import AdminDashboard from './pages/admin/AdminDashboard';
import Analytics from './pages/admin/Analytics';
import ManageInternships from './pages/admin/ManageInternships';
import ManageUsers from './pages/admin/ManageUsers';
import InternshipDetails from './pages/InternshipDetails';
import Internships from './pages/Internships';
import Landing from './pages/Landing';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Notifications from './pages/Notifications';
import Applicants from './pages/recruiter/Applicants';
import InternshipForm from './pages/recruiter/InternshipForm';
import RecruiterDashboard from './pages/recruiter/RecruiterDashboard';
import RecruiterProfile from './pages/recruiter/RecruiterProfile';
import Register from './pages/Register';
import Bookmarks from './pages/student/Bookmarks';
import MyApplications from './pages/student/MyApplications';
import Profile from './pages/student/Profile';
import StudentDashboard from './pages/student/StudentDashboard';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="internships" element={<Internships />} />
        <Route path="internships/:id" element={<InternshipDetails />} />

        <Route element={<GuestOnly />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="notifications" element={<Notifications />} />
          <Route path="account" element={<Account />} />
        </Route>

        <Route path="student" element={<ProtectedRoute roles={['student']} />}>
          <Route index element={<StudentDashboard />} />
          <Route path="applications" element={<MyApplications />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="recruiter" element={<ProtectedRoute roles={['recruiter']} />}>
          <Route index element={<RecruiterDashboard />} />
          <Route path="profile" element={<RecruiterProfile />} />
          <Route path="internships/new" element={<InternshipForm />} />
          <Route path="internships/:id/edit" element={<InternshipForm />} />
          <Route path="internships/:id/applicants" element={<Applicants />} />
        </Route>

        <Route path="admin" element={<ProtectedRoute roles={['admin']} />}>
          <Route index element={<AdminDashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="internships" element={<ManageInternships />} />
          <Route path="internships/:id/applicants" element={<Applicants />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
