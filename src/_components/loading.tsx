import { TbFidgetSpinner } from "react-icons/tb";

export default function Loading() {
  return <TbFidgetSpinner
    size={50}
    opacity={0.8}
    className="animate-spin"
    color="white"
  />;
}