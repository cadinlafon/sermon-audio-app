import { Navigate } from "react-router-dom";
import { auth } from "../firebase";

export default function AdminRoute({ children }) {
  const user = auth.currentUser;

  const ADMIN_EMAIL = "cadinlafon@gmail.com";

  if (!user) {
    return <Navigate to="/" />;
  }

  if (user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" />;
  }

  return children;
}
