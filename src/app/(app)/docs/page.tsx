import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { DocsView } from "./docs-view";

export const metadata: Metadata = {
  title: "Документация · Projectra",
  description: "Полное руководство по работе в Projectra",
};

export default async function DocsPage() {
  // Auth only — the docs are the same for everyone.
  await requireUser();
  return <DocsView />;
}
