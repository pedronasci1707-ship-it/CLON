import type { Metadata } from "next";
import { WorkWorkspace } from "@/components/clones/WorkWorkspace";

export const metadata: Metadata = { title: "Work Clone" };

export default function WorkPage() {
  return <WorkWorkspace />;
}
