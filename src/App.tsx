import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppProvider } from "./context/AppContext";
import { Dashboard } from "./pages/Dashboard";
import { Inbox } from "./pages/Inbox";
import { LegacyReceivingRedirect } from "./pages/LegacyReceivingRedirect";
import { Login } from "./pages/Login";
import { NewReferral } from "./pages/NewReferral";
import { ReferralDetail } from "./pages/ReferralDetail";
import { ReferralPreview } from "./pages/ReferralPreview";
import { ReferralTracker } from "./pages/ReferralTracker";
import { RetrieveReferral } from "./pages/RetrieveReferral";
import { Settings } from "./pages/Settings";
import { TerminologyCheck } from "./pages/TerminologyCheck";

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="referrals" element={<ReferralTracker />} />
              <Route path="referrals/:id" element={<ReferralDetail />} />
              <Route path="referrals/search" element={<RetrieveReferral />} />
              <Route path="terminology" element={<TerminologyCheck />} />
              <Route path="receiving/:taskId" element={<LegacyReceivingRedirect />} />
              <Route element={<ProtectedRoute roles={["referring_facility_user"]} />}>
                <Route path="referrals/new" element={<NewReferral />} />
                <Route path="referrals/preview" element={<ReferralPreview />} />
              </Route>
              <Route element={<ProtectedRoute roles={["receiving_facility_user", "admin"]} />}>
                <Route path="inbox" element={<Inbox />} />
              </Route>
              <Route element={<ProtectedRoute roles={["admin"]} />}>
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
