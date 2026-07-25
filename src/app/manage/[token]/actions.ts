"use server";

import { redirect } from "next/navigation";
import {
  cancelAppointment,
  getAppointmentByManageToken,
  rescheduleAppointment,
} from "@/lib/appointment-management";

function destination(token: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `/manage/${encodeURIComponent(token)}?${query}`;
}

export async function rescheduleClientAppointment(
  token: string,
  formData: FormData,
) {
  const appointment = await getAppointmentByManageToken(token);
  if (!appointment) redirect(destination(token, { error: "invalid" }));

  let notificationsDelivered = false;
  try {
    const result = await rescheduleAppointment(
      appointment.id,
      String(formData.get("startsAt") ?? ""),
      String(formData.get("endsAt") ?? ""),
      "client",
      token,
    );
    notificationsDelivered = result.notificationsDelivered;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reschedule appointment.";
    redirect(destination(token, { error: message }));
  }
  redirect(
    destination(token, {
      updated: "1",
      ...(!notificationsDelivered ? { delivery: "delayed" } : {}),
    }),
  );
}

export async function cancelClientAppointment(token: string) {
  const appointment = await getAppointmentByManageToken(token);
  if (!appointment) redirect(destination(token, { error: "invalid" }));

  let notificationsDelivered = false;
  try {
    const result = await cancelAppointment(appointment.id, "client", token);
    notificationsDelivered = result.notificationsDelivered;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not cancel appointment.";
    redirect(destination(token, { error: message }));
  }
  redirect(
    destination(token, {
      cancelled: "1",
      ...(!notificationsDelivered ? { delivery: "delayed" } : {}),
    }),
  );
}
