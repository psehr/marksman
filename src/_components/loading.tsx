import { TbFidgetSpinner } from "react-icons/tb";

export default function Loading(props: { size?: number }) {
  return (
    <TbFidgetSpinner
      size={props.size ? props.size : 50}
      opacity={0.8}
      className="animate-spin"
      color="white"
    />
  );
}
