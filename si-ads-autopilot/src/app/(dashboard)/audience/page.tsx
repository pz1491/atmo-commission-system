import { requireOrgContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiscoveryForm } from "./discovery-form";
import type { InterestResult } from "@/services/audience/discover";

function InterestList({ items }: { items: InterestResult[] }) {
  if (items.length === 0) return <p className="text-xs text-secondary-text">None found.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i, idx) => (
        <Badge key={idx} tone={i.available ? "success" : "default"} title={i.reason}>
          {i.name} {!i.available && "— Unavailable for targeting"}
        </Badge>
      ))}
    </div>
  );
}

export default async function AudiencePage() {
  const { organizationId } = await requireOrgContext();
  const suggestions = await prisma.audienceSuggestion.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold">Audience Discovery</h1>

      <Card>
        <CardHeader>
          <CardTitle>Describe your product</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscoveryForm />
        </CardContent>
      </Card>

      {suggestions.map((s) => (
        <Card key={s.id}>
          <CardHeader>
            <CardTitle>{s.productName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-secondary-text">
              <span>Product</span>→<span>Core Interest</span>→<span>Related Interest</span>→
              <span>Lifestyle</span>→<span>Purchase Intent</span>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Direct Interest</div>
              <InterestList items={s.directInterests as unknown as InterestResult[]} />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Indirect Interest</div>
              <InterestList items={s.indirectInterests as unknown as InterestResult[]} />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Lifestyle Interest</div>
              <InterestList items={s.lifestyleInterests as unknown as InterestResult[]} />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Behavior / Intent</div>
              <InterestList items={s.behaviorIntent as unknown as InterestResult[]} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
