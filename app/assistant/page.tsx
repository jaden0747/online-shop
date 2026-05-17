import { getPendingLeads, getAllLeads } from "@/lib/data/leads";
import { getPendingReviews, getAllPendingReviews } from "@/lib/data/pending-reviews";
import { getAssistantLogs } from "@/lib/data/assistant-log";
import { getAllCustomers } from "@/lib/data/customers";
import { getAllPricing } from "@/lib/data/pricing";
import { getAllConversationControls } from "@/lib/data/conversation-control";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { updateLeadStatusAction } from "@/app/actions/assistant";
import { ReviewActions } from "./review-form";
import { ConvertLeadDialog } from "./convert-lead-dialog";
import { HandoffReleaseButton } from "./handoff-release-button";
import { HandoffTakeoverButton } from "./handoff-takeover-button";

export const dynamic = "force-dynamic";

const REVIEW_TYPE_LABELS: Record<string, string> = {
  new_address: "New address",
  cancellation_request: "Cancellation",
  refund_request: "Refund",
  renewal_request: "Renewal",
  payment_proof: "Payment proof",
  phone_change: "Phone change",
  price_change: "Price change",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PayloadDisplay({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <dl className="text-xs space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <dt className="text-muted-foreground shrink-0">{k}:</dt>
          <dd className="font-medium truncate max-w-[200px]">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  human_outbound_zalo: "Manager Zalo reply",
  manager_app_action: "Manager app action",
  bot_escalation: "Bot escalation",
};

export default async function AssistantPage() {
  const pendingLeads = getPendingLeads();
  const allLeads = getAllLeads();
  const pendingReviews = getPendingReviews();
  const allReviews = getAllPendingReviews();
  const logs = getAssistantLogs(50);
  const customers = getAllCustomers();
  const pricing = getAllPricing();
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const now = new Date();
  const allHandoffs = getAllConversationControls();
  const activeHandoffs = allHandoffs.filter(
    (h) => h.mode === "human_active" && h.lockExpiresAt && new Date(h.lockExpiresAt) > now
  );
  const activeHandoffIds = new Set(activeHandoffs.map((h) => h.externalUserId));

  const recentLeads = allLeads
    .filter((l) => l.status !== "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const recentReviews = allReviews
    .filter((r) => r.status !== "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Assistant</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage Zalo bot activity, leads, and review requests</p>
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">
            Leads
            {pendingLeads.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0 h-4">
                {pendingLeads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Reviews
            {pendingReviews.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0 h-4">
                {pendingReviews.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="handoffs">
            Handoffs
            {activeHandoffs.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-4 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                {activeHandoffs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">API Logs</TabsTrigger>
        </TabsList>

        {/* LEADS TAB */}
        <TabsContent value="leads" className="space-y-6">
          {pendingLeads.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-orange-600 dark:text-orange-400">
                Pending ({pendingLeads.length})
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Phone</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Goal</th>
                      <th className="text-left px-3 py-2 font-medium">Meals/day</th>
                      <th className="text-left px-3 py-2 font-medium">Plan interest</th>
                      <th className="text-left px-3 py-2 font-medium">Note</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                      <th className="px-3 py-2 font-medium">Bot</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{lead.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{lead.phone}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{lead.source}</td>
                        <td className="px-3 py-2 text-xs">{lead.goal ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{lead.mealsPerDay ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{lead.planInterest ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] truncate">{lead.note ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(lead.createdAt)}</td>
                        <td className="px-3 py-2 text-center">
                          {lead.externalUserId && activeHandoffIds.has(lead.externalUserId) ? (
                            <HandoffReleaseButton channel="zalouser" externalUserId={lead.externalUserId} />
                          ) : (
                            <HandoffTakeoverButton channel="zalouser" externalUserId={lead.externalUserId ?? null} />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <ConvertLeadDialog lead={lead} pricing={pricing} />
                            <form action={updateLeadStatusAction}>
                              <input type="hidden" name="id" value={lead.id} />
                              <input type="hidden" name="status" value="rejected" />
                              <button
                                type="submit"
                                className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                              >
                                Reject
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {recentLeads.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent ({recentLeads.length})</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Phone</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{lead.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{lead.phone}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{lead.source}</td>
                        <td className="px-3 py-2">
                          <Badge variant={lead.status === "converted" ? "default" : "secondary"} className="text-xs">
                            {lead.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(lead.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {pendingLeads.length === 0 && recentLeads.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No leads yet.</p>
          )}
        </TabsContent>

        {/* REVIEWS TAB */}
        <TabsContent value="reviews" className="space-y-6">
          {pendingReviews.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-orange-600 dark:text-orange-400">
                Pending ({pendingReviews.length})
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Customer</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Details</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pendingReviews.map((review) => {
                      const customer = review.customerId ? customerMap.get(review.customerId) : null;
                      return (
                        <tr key={review.id} className="hover:bg-muted/30 align-top">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {REVIEW_TYPE_LABELS[review.type] ?? review.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {customer ? (
                              <div>
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{customer.phone}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{review.customerId ?? "—"}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{review.source}</td>
                          <td className="px-3 py-2">
                            <PayloadDisplay payload={review.payload} />
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(review.createdAt)}</td>
                          <td className="px-3 py-2">
                            <ReviewActions id={review.id} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {recentReviews.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Recent ({recentReviews.length})</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Customer</th>
                      <th className="text-left px-3 py-2 font-medium">Source</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Manager note</th>
                      <th className="text-left px-3 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentReviews.map((review) => {
                      const customer = review.customerId ? customerMap.get(review.customerId) : null;
                      return (
                        <tr key={review.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {REVIEW_TYPE_LABELS[review.type] ?? review.type}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {customer?.name ?? review.customerId ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{review.source}</td>
                          <td className="px-3 py-2">
                            <Badge variant={review.status === "approved" ? "default" : "secondary"} className="text-xs">
                              {review.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                            {review.managerNote ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(review.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {pendingReviews.length === 0 && recentReviews.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet.</p>
          )}
        </TabsContent>

        {/* HANDOFFS TAB */}
        <TabsContent value="handoffs" className="space-y-6">
          {/* All customers — quick take-over */}
          {(() => {
            // Build phone (digits only) → externalUserId from most-recent lead per phone
            const phoneToExtId = new Map<string, string>();
            allLeads
              .filter((l) => l.externalUserId)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .forEach((l) => {
                const digits = l.phone.replace(/\D/g, "");
                if (!phoneToExtId.has(digits)) phoneToExtId.set(digits, l.externalUserId!);
              });

            if (customers.length === 0) return null;
            return (
              <section>
                <h2 className="text-sm font-semibold mb-1">All customers</h2>
                <p className="text-xs text-muted-foreground mb-2">
                  Click <strong>Take Over</strong> before you reply to a customer in Zalo to silence the bot. Click <strong>Release</strong> when you&apos;re done.
                  Customers without a Zalo ID haven&apos;t messaged the bot yet.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground text-xs">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Phone</th>
                        <th className="text-left px-3 py-2 font-medium">Zalo ID</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Bot control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {customers.map((customer) => {
                        const extId = phoneToExtId.get(customer.phone.replace(/\D/g, "")) ?? null;
                        const isActive = !!extId && activeHandoffIds.has(extId);
                        return (
                          <tr key={customer.id} className={`hover:bg-muted/30 ${isActive ? "bg-orange-50/40 dark:bg-orange-950/10" : ""}`}>
                            <td className="px-3 py-2 font-medium">{customer.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{customer.phone}</td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{extId ?? <span className="opacity-40">—</span>}</td>
                            <td className="px-3 py-2">
                              {isActive ? (
                                <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-0">
                                  Human active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Bot</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isActive ? (
                                <HandoffReleaseButton channel="zalouser" externalUserId={extId!} />
                              ) : (
                                <HandoffTakeoverButton channel="zalouser" externalUserId={extId} />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })()}

          {activeHandoffs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-orange-600 dark:text-orange-400">
                Active ({activeHandoffs.length})
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Channel</th>
                      <th className="text-left px-3 py-2 font-medium">Zalo User ID</th>
                      <th className="text-left px-3 py-2 font-medium">Trigger</th>
                      <th className="text-left px-3 py-2 font-medium">Expires</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeHandoffs.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/30 bg-orange-50/40 dark:bg-orange-950/10">
                        <td className="px-3 py-2 text-xs">{h.channel}</td>
                        <td className="px-3 py-2 font-mono text-xs">{h.externalUserId}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {SOURCE_LABELS[h.source ?? ""] ?? h.source ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {h.lockExpiresAt ? fmtDate(h.lockExpiresAt) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <HandoffReleaseButton channel={h.channel} externalUserId={h.externalUserId} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {allHandoffs.length > activeHandoffs.length && (
            <section>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
                Expired / Bot mode ({allHandoffs.length - activeHandoffs.length})
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Channel</th>
                      <th className="text-left px-3 py-2 font-medium">Zalo User ID</th>
                      <th className="text-left px-3 py-2 font-medium">Mode</th>
                      <th className="text-left px-3 py-2 font-medium">Last trigger</th>
                      <th className="text-left px-3 py-2 font-medium">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allHandoffs
                      .filter((h) => !activeHandoffs.includes(h))
                      .map((h) => (
                        <tr key={h.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 text-xs">{h.channel}</td>
                          <td className="px-3 py-2 font-mono text-xs">{h.externalUserId}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-xs">{h.mode}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {SOURCE_LABELS[h.source ?? ""] ?? h.source ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDate(h.updatedAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {allHandoffs.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">No handoff records yet.</p>
          )}
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No API activity yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Action</th>
                    <th className="text-left px-3 py-2 font-medium">Customer</th>
                    <th className="text-left px-3 py-2 font-medium">Source</th>
                    <th className="text-left px-3 py-2 font-medium">Request</th>
                    <th className="text-left px-3 py-2 font-medium">Result</th>
                    <th className="text-left px-3 py-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => {
                    const customer = log.customerId ? customerMap.get(log.customerId) : null;
                    const isError = (log.result as Record<string, unknown>).status === "error";
                    return (
                      <tr key={log.id} className={`hover:bg-muted/30 align-top ${isError ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                        <td className="px-3 py-2">
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.action}</code>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {customer?.name ?? log.customerId ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          <div>{log.source}</div>
                          {log.externalUserId && (
                            <div className="font-mono opacity-60">{log.externalUserId}</div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <PayloadDisplay payload={log.request} />
                        </td>
                        <td className="px-3 py-2">
                          <PayloadDisplay payload={log.result} />
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
