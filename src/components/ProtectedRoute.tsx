import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppContext } from "../context/useAppContext";
import type { FacilityRole } from "../types";

interface ProtectedRouteProps {
  roles?: FacilityRole[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { currentAccount } = useAppContext();
  const location = useLocation();
  if (!currentAccount) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(currentAccount.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
