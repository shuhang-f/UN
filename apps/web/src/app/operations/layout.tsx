import type { Metadata } from "next";
import "../property.css";

export const metadata: Metadata = {
  title: "UN — Vacancy & maintenance workflows",
  description: "Turn selected operational context into practical workflows and existing-tool recommendations for multifamily property managers.",
};

export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <div className="operations-root">{children}</div>;
}
