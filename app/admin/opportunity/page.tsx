import { AdminShell } from "@/components/admin/admin-shell";
import { OpportunityDashboard } from "@/components/admin/opportunity-dashboard";

export default function OpportunityPage() {
  return <AdminShell active="Opportunity"><div className="admin-title"><div><p>Trend intelligence</p><h1>Drama opportunity</h1></div></div><OpportunityDashboard /></AdminShell>;
}
