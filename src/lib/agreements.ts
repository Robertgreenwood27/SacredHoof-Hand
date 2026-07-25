import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/server";
import {
  TERMS_EFFECTIVE_DATE,
  TERMS_TEXT,
  TERMS_VERSION,
  WAIVER_TEXT,
  WAIVER_VERSION,
} from "./legal";

export const TERMS_SHA256 = createHash("sha256")
  .update(TERMS_TEXT, "utf8")
  .digest("hex");
export const WAIVER_SHA256 = createHash("sha256")
  .update(WAIVER_TEXT, "utf8")
  .digest("hex");

export const CURRENT_AGREEMENT_EVIDENCE = {
  termsVersion: TERMS_VERSION,
  termsHash: TERMS_SHA256,
  waiverVersion: WAIVER_VERSION,
  waiverHash: WAIVER_SHA256,
} as const;

export type AgreementAcceptanceInput = {
  clientName: string;
  clientEmail: string;
  signatureName: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  electronicConsent: boolean;
  authorizedSigner: boolean;
  signerCapacity: "self" | "parent_or_guardian";
  guardianRelationship?: string;
  request: Request;
};

function requestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    null
  )?.slice(0, 200) ?? null;
}

/**
 * Persists the exact legal text presented at signing before a free booking or
 * Stripe Checkout session is created. This gives each acceptance an immutable,
 * reproducible evidence record even after the public documents are updated.
 */
export async function createAgreementAcceptance(
  input: AgreementAcceptanceInput,
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const signedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("booking_agreements")
    .insert({
      client_name: input.clientName,
      client_email: input.clientEmail,
      signature_name: input.signatureName,
      service_id: input.serviceId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      terms_version: TERMS_VERSION,
      terms_effective_date: TERMS_EFFECTIVE_DATE,
      terms_snapshot: TERMS_TEXT,
      waiver_version: WAIVER_VERSION,
      waiver_snapshot: WAIVER_TEXT,
      electronic_consent: input.electronicConsent,
      signer_authority: input.authorizedSigner,
      signer_capacity: input.signerCapacity,
      guardian_relationship: input.guardianRelationship?.trim() || null,
      signed_at: signedAt,
      signer_ip: requestIp(input.request),
      signer_user_agent:
        input.request.headers.get("user-agent")?.slice(0, 1000) ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not record the signed agreements: ${error?.message ?? "unknown error"}`,
    );
  }

  return data.id as string;
}
