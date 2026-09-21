import { requireOrgContext } from "@/lib/session";
import { getCampaignTree } from "@/services/campaigns/tree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignTreeView } from "./campaign-tree";

export default async function CampaignsPage() {
  const { organizationId } = await requireOrgContext();
  const campaigns = await getCampaignTree(organizationId);

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Campaign Explorer</h1>
      <Card>
        <CardHeader>
          <CardTitle>Campaign → Ad Set → Ad</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-text">
              No campaigns synced yet.
            </p>
          ) : (
            <CampaignTreeView campaigns={campaigns} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
