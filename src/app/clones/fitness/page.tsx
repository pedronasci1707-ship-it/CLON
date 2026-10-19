import type { Metadata } from "next";
import { FitnessWorkspace } from "@/components/clones/FitnessWorkspace";

export const metadata: Metadata = { title: "Fitness Clone" };

export default function FitnessPage() {
  return <FitnessWorkspace />;
}
