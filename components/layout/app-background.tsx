import Image from "next/image";
import { StarfieldBackground } from "@/components/brand/starfield-background";

export function AppBackground({ variant = "vector" }: { variant?: "vector" | "stars" }) {
  if (variant === "stars") return <StarfieldBackground />;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 bg-[#050505]" aria-hidden="true">
      <Image
        src="/fundo-site-vetorial.svg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-90"
      />
    </div>
  );
}
