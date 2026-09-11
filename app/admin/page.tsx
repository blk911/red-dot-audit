import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getPrivateResearchEmails, getCommerceReadiness, getSendGridApiKey, getStripeWebhookSecret } from "@/lib/commerce/config";
import { getD1 } from "@/lib/commerce/config";
import { getAdminCounts, getAdminLists } from "@/lib/admin/store";
import AdminConsole from "./admin-console";

export const metadata: Metadata = { title: "Admin — Red Dot Audit", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  if (!getPrivateResearchEmails().includes(user.email.toLowerCase())) notFound();

  const [counts, lists, orderStats] = await Promise.all([
    getAdminCounts(),
    getAdminLists(),
    getD1().prepare("SELECT COUNT(*) total, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) paid FROM purchases").first<{ total: number; paid: number | null }>(),
  ]);

  return <main className="admin-page">
    <header className="admin-header">
      <Link className="brand" href="/"><span className="brand-mark"><span /></span><span>RED DOT AUDIT</span><small>ADMIN</small></Link>
      <div><span>{user.displayName}</span><Link href="/">Public site</Link></div>
    </header>
    <AdminConsole
      counts={counts}
      data={lists}
      orderStats={{ total: orderStats?.total || 0, paid: orderStats?.paid || 0 }}
      system={{ commerce: getCommerceReadiness(), sendGrid: Boolean(getSendGridApiKey()), stripeWebhook: Boolean(getStripeWebhookSecret()), scheduler: false, automaticMail: false, automaticCommunityPosting: false }}
    />
  </main>;
}
