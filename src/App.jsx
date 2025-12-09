import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from './components/ProtectedRoute'
import SignUp from './pages/auth/SignUp'
import Login from './pages/auth/Login'
import ResetPassword from './pages/auth/ResetPassword'
import EmailVerification from './pages/auth/EmailVerification'
import Onboarding from './pages/onboarding/Onboarding'
import Dashboard from './pages/Dashboard'
import CreateCampaign from './pages/CreateCampaign'
import CampaignStep1 from './pages/campaign/CampaignStep1'
import CampaignStep2 from './pages/campaign/CampaignStep2'
import CampaignStep3 from './pages/campaign/CampaignStep3'
import CampaignStep4 from './pages/campaign/CampaignStep4'
import CampaignStep5 from './pages/campaign/CampaignStep5'
import CampaignEdit from './pages/CampaignEdit'
import CampaignDetails from './pages/CampaignDetails'
import BlastStep1 from './pages/blast/BlastStep1'
import BlastStep2 from './pages/blast/BlastStep2'
import BlastStep3 from './pages/blast/BlastStep3'
import BlastStep4 from './pages/blast/BlastStep4'
import BlastStep5 from './pages/blast/BlastStep5'
import CreateBlast from './pages/CreateBlast'
import History from './pages/History'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCampaigns from './pages/admin/AdminCampaigns'
import AdminCampaignDetails from './pages/admin/AdminCampaignDetails'
import AdminUsers from './pages/admin/AdminUsers'
import AdminUserDetails from './pages/admin/AdminUserDetails'
import AdminTransactions from './pages/admin/AdminTransactions'
import AdminActivity from './pages/admin/AdminActivity'
import AdminProtectedRoute from './components/admin/AdminProtectedRoute'
import './App.css'

function App() {
  return (
    <>
      <Routes>
        {/* Admin routes - Real Supabase authentication */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="campaigns" element={<AdminCampaigns />} />
          <Route path="campaigns/:campaignId" element={<AdminCampaignDetails />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetails />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* Public routes */}
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Email verification - requires authentication only */}
        <Route
          path="/verify-email"
          element={
            <ProtectedRoute>
              <EmailVerification />
            </ProtectedRoute>
          }
        />

        {/* Onboarding - requires authentication + email verification */}
        <Route
          path="/onboarding/*"
          element={
            <ProtectedRoute requireEmailVerification>
              <Onboarding />
            </ProtectedRoute>
          }
        />

        {/* Dashboard - requires authentication + email verification + onboarding */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Campaign routes - require authentication + email verification + onboarding */}
        <Route
          path="/create-campaign"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignStep1 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/step1"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignStep1 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/step2"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignStep2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/step3"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignStep3 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/step4"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignStep4 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/step5"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignStep5 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/:campaignId/edit"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaign/:campaignId/details"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CampaignDetails />
            </ProtectedRoute>
          }
        />

        {/* Blast routes - require authentication + email verification + onboarding */}
        <Route
          path="/blast/step1"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <BlastStep1 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blast/step2"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <BlastStep2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blast/step3"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <BlastStep3 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blast/step4"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <BlastStep4 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/blast/step5"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <BlastStep5 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-blast"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <CreateBlast />
            </ProtectedRoute>
          }
        />

        {/* Other app routes - require authentication + email verification + onboarding */}
        <Route
          path="/history"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute requireEmailVerification requireOnboarding>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  )
}

export default App
