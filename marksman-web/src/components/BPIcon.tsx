const sizes = {
  sm: 16,
  md: 24,
  lg: 32,
};

import Image from "next/image";

export default function BPIcon({ size = "md" }: { size?: keyof typeof sizes }) {
  return (
    <Image
      src="/images/bp-coin.svg"
      alt="Bounty Points"
      width={sizes[size]}
      height={sizes[size]}
    />
  );
}
