import type { Metadata } from "next";
import { LifeWorkspace } from "@/components/clones/LifeWorkspace";

export const metadata: Metadata = { title: "Life Clone" };

export default function LifePage() {
  return <LifeWorkspace />;
}
