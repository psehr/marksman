import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "../../src/components/auth/AuthProvider";

function Probe() {
  const { user, loading, error, alphaAccess, refreshUser } = useAuth();
  return <>
    <button onClick={() => void refreshUser()}>Refresh</button>
    <output>{JSON.stringify({ user, loading, error, alphaAccess })}</output>
  </>;
}
const root = createRoot(document.getElementById("root")!);
root.render(<AuthProvider><Probe /></AuthProvider>);
(window as unknown as { unmount: () => void }).unmount = () => root.unmount();
