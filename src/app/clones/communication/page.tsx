import type { Metadata } from "next";
import { CommunicationWorkspace } from "@/components/clones/CommunicationWorkspace";

export const metadata: Metadata = { title: "Communication Clone" };

export default function CommunicationPage() {
  return <CommunicationWorkspace />;
}
