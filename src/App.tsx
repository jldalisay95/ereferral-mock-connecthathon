import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppProvider } from "./context/AppContext";
import { Dashboard } from "./pages/Dashboard";
import { ConnectathonGuide } from "./pages/ConnectathonGuide";
import { Inbox } from "./pages/Inbox";
import { Login } from "./pages/Login";
import { NewReferral } from "./pages/NewReferral";
import { PatientRegistry } from "./pages/PatientRegistry";
import { ParticipantSetup } from "./pages/ParticipantSetup";
import { ReferralDetail } from "./pages/ReferralDetail";
import { ReferralPreview } from "./pages/ReferralPreview";
import { ReferralPrint } from "./pages/ReferralPrint";
import { ReferralTracker } from "./pages/ReferralTracker";
import { RegisterFacility } from "./pages/RegisterFacility";
import { RetrieveReferral } from "./pages/RetrieveReferral";
import { SentReferrals } from "./pages/SentReferrals";
import { Settings } from "./pages/Settings";
import { TerminologyCheck } from "./pages/TerminologyCheck";

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/participant-setup" element={<ParticipantSetup />} />
          <Route path="/register" element={<RegisterFacility />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="connectathon-guide" element={<ConnectathonGuide />} />
              <Route path="referrals" element={<ReferralTracker />} />
              <Route path="referrals/sent" element={<SentReferrals />} />
              <Route path="referrals/incoming" element={<Inbox />} />
              <Route path="referrals/:id" element={<ReferralDetail />} />
              <Route path="referrals/:id/print" element={<ReferralPrint />} />
              <Route path="referrals/search" element={<RetrieveReferral />} />
              <Route path="terminology" element={<TerminologyCheck />} />
              <Route path="inbox" element={<Navigate to="/referrals/incoming" replace />} />
              <Route element={<ProtectedRoute roles={["facility_user"]} />}>
                <Route path="patients" element={<PatientRegistry />} />
                <Route path="referrals/new" element={<NewReferral />} />
                <Route path="referrals/preview" element={<ReferralPreview />} />
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
