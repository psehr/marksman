import { createRoot } from "react-dom/client";
import CopyText from "../../src/components/ui/CopyText";

createRoot(document.getElementById("root")!).render(
  <CopyText text={'I completed this bounty!\n100 BP earned.'} label="Share achievement" />,
);
