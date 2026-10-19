import type { Metadata } from "next";
import { MasterWorkspace } from "@/components/clones/MasterWorkspace";

export const metadata: Metadata = { title: "Master Clone" };

export default function MasterPage() {
  return <MasterWorkspace />;
}
