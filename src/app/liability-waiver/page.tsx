import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { LIABILITY_WAIVER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Liability Waiver | Sacred Hoof & Hand",
  description:
    "Liability waiver and assumption of risk information for Sacred Hoof & Hand wellness and equine-assisted activities.",
};

export default function LiabilityWaiverPage() {
  return (
    <LegalDocumentPage
      document={LIABILITY_WAIVER}
      companion={{
        href: "/terms",
        label: "Terms of Service",
      }}
    />
  );
}
