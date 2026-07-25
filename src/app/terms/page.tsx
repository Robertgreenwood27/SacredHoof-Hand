import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/LegalDocumentPage";
import { TERMS_OF_SERVICE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | Sacred Hoof & Hand",
  description:
    "Terms governing Sacred Hoof & Hand wellness services, bookings, payments, safety, and client responsibilities.",
};

export default function TermsPage() {
  return (
    <LegalDocumentPage
      document={TERMS_OF_SERVICE}
      companion={{
        href: "/liability-waiver",
        label: "Liability Waiver and Assumption of Risk Agreement",
      }}
    />
  );
}
