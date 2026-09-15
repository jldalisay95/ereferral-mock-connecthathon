import { Navigate, Link, useNavigate } from "react-router-dom";
import { FacilityRegistrationForm } from "../components/FacilityRegistrationForm";
import { useAppContext } from "../context/useAppContext";

export function RegisterFacility() {
  const {
    connectathonConfig,
    currentAccount,
    endpoints,
    selfRegisterFacility
  } = useAppContext();
  const navigate = useNavigate();

  if (currentAccount) return <Navigate to="/dashboard" replace />;

  return (
    <main className="registration-shell">
      <section className="registration-card">
        <p className="eyebrow">Synthetic Connectathon onboarding</p>
        <div className="section-heading">
          <div>
            <h1>Create a facility account</h1>
            <p>
              Register locally in the <strong>{connectathonConfig.preset}</strong>{" "}
              preset. No Organization is sent to a FHIR server during signup.
            </p>
          </div>
          <span className={`preset-badge preset-${connectathonConfig.preset}`}>
            {connectathonConfig.preset === "participant"
              ? "Participant starter"
              : "Connectathon ready"}
          </span>
        </div>
        <FacilityRegistrationForm
          terminologyBaseUrl={endpoints.terminologyBaseUrl}
          onSubmit={(value) => {
            selfRegisterFacility(value);
            navigate("/dashboard", { replace: true });
          }}
        />
        <p className="login-note">
          Already have an account? <Link to="/login">Return to login</Link>.
        </p>
      </section>
    </main>
  );
}
