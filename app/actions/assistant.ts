"use server";

import { revalidatePath } from "next/cache";
import { updateLeadStatus, getLeadById } from "@/lib/data/leads";
import { updateReviewStatus, getReviewById } from "@/lib/data/pending-reviews";
import { getAllCustomers, createCustomer, createAddress } from "@/lib/data/customers";
import { createSubscription } from "@/lib/data/subscriptions";
import { addWorkingDays } from "@/lib/utils/subscription";
import { setConversationControl, clearConversationControl } from "@/lib/data/conversation-control";
import { getAllLeads } from "@/lib/data/leads";
import type { CustomerLead, PendingReview } from "@/lib/data/types";

function handoffByExternalUserId(externalUserId: string | null) {
  if (!externalUserId) return;
  setConversationControl({
    channel: "zalouser",
    externalUserId,
    mode: "human_active",
    source: "manager_app_action",
  });
}

function handoffByCustomerId(customerId: string | null) {
  if (!customerId) return;
  const lead = getAllLeads().find((l) => l.phone === customerId && l.externalUserId);
  if (lead?.externalUserId) handoffByExternalUserId(lead.externalUserId);
}

export async function updateLeadStatusAction(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as CustomerLead["status"];
  if (!id || !status) return;
  const lead = getLeadById(id);
  updateLeadStatus(id, status);
  handoffByExternalUserId(lead?.externalUserId ?? null);
  revalidatePath("/assistant");
}

export async function convertLeadAction(formData: FormData): Promise<{ error?: string }> {
  const leadId = formData.get("leadId") as string;
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() ?? "";
  const addressLabel = (formData.get("addressLabel") as string)?.trim() || "Nhà";
  const zone = (formData.get("zone") as string)?.trim() ?? "";
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!leadId || !name || !phone) return { error: "Name and phone are required" };

  const lead = getLeadById(leadId);

  let customer = getAllCustomers().find((c) => c.phone === phone);
  if (!customer) {
    customer = createCustomer({ name, phone, address, zone, notes });
  }

  if (address) {
    createAddress({
      customerId: customer.id,
      label: addressLabel,
      address,
      zone,
      isDefault: true,
      latitude: lead?.geocodedLat ?? null,
      longitude: lead?.geocodedLng ?? null,
    });
  }

  if (formData.get("createSubscription") === "1") {
    const plan = (formData.get("plan") as string) ?? "weekly";
    const goal = (formData.get("goal") as string) ?? "maintenance";
    const mealsPerDay = parseInt(formData.get("mealsPerDay") as string, 10) || 1;
    const subscriptionPrice = parseFloat(formData.get("subscriptionPrice") as string) || 0;
    const shippingPrice = parseFloat(formData.get("shippingPrice") as string) || 0;
    const trialDaysRaw = formData.get("trialDays") as string | null;
    const trialDays = plan === "trial" && trialDaysRaw ? parseInt(trialDaysRaw, 10) : null;
    const startDate = new Date((formData.get("startDate") as string) || new Date().toISOString().slice(0, 10));
    const endDateRaw = formData.get("endDate") as string | null;
    let endDate: Date;
    if (endDateRaw) {
      endDate = new Date(endDateRaw);
    } else if (plan === "weekly") {
      endDate = addWorkingDays(startDate, 4);
    } else if (plan === "monthly") {
      endDate = addWorkingDays(startDate, 19);
    } else {
      endDate = addWorkingDays(startDate, (trialDays ?? 3) - 1);
    }
    createSubscription({
      customerId: customer.id,
      plan,
      goal,
      mealsPerDay,
      subscriptionPrice,
      shippingPrice,
      discount: 0,
      trialDays,
      status: "active",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      endDateNoSkip: endDate.toISOString(),
      cancelReason: null,
      cancelledAt: null,
      addressId: null,
    });
  }

  updateLeadStatus(leadId, "converted");
  handoffByExternalUserId(lead?.externalUserId ?? null);
  revalidatePath("/assistant");
  revalidatePath("/customers");
  revalidatePath("/subscriptions");
  return {};
}

export async function updateReviewStatusAction(formData: FormData) {
  const id = formData.get("id") as string;
  const status = formData.get("status") as PendingReview["status"];
  const note = formData.get("note") as string | null;
  if (!id || !status) return;
  const review = getReviewById(id);
  updateReviewStatus(id, status, note?.trim() || undefined);
  // Manager handled this review — silence the bot for this customer's conversation
  if (review?.externalUserId) {
    handoffByExternalUserId(review.externalUserId);
  } else {
    handoffByCustomerId(review?.customerId ?? null);
  }
  revalidatePath("/assistant");
}

export async function releaseHandoffAction(channel: string, externalUserId: string) {
  clearConversationControl(channel, externalUserId);
  revalidatePath("/assistant");
}

export async function takeOverHandoffAction(channel: string, externalUserId: string) {
  if (!channel || !externalUserId) return;
  setConversationControl({
    channel,
    externalUserId,
    mode: "human_active",
    source: "manager_app_action",
  });
  revalidatePath("/assistant");
}

