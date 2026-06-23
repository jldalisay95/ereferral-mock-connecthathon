import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AppProvider } from "./context/AppContext";
import { Dashboard } from "./pages/Dashboard";
import { NewReferral } from "./pages/NewReferral";
import { ReceivingFacilityView } from "./pages/ReceivingFacilityView";
import { ReferralPreview } from "./pages/ReferralPreview";
import { RetrieveReferral } from "./pages/RetrieveReferral";
import { TerminologyCheck } from "./pages/TerminologyCheck";

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="terminology" element={<TerminologyCheck />} />
            <Route path="referrals/new" element={<NewReferral />} />
            <Route path="referrals/preview" element={<ReferralPreview />} />
            <Route path="referrals/search" element={<RetrieveReferral />} />
            <Route path="receiving/:taskId" element={<ReceivingFacilityView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
