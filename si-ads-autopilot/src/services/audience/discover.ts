import { prisma } from "@/lib/prisma";
import { MetaAdsAdapter } from "@/services/meta";

// Audience Discovery (spec section 11). Candidate interests come from a
// disclosed keyword dictionary — not an AI guess — and every candidate is
// then verified against Meta's real targeting-search endpoint before it's
// shown as available. Anything that doesn't resolve to a real Meta interest
// is labeled "Unavailable for targeting", never presented as targetable.

interface DictionaryEntry {
  keywords: string[];
  direct: string[];
  indirect: string[];
  lifestyle: string[];
  behavior: string[];
}

const DICTIONARY: DictionaryEntry[] = [
  {
    keywords: ["flower", "vase", "ดอกไม้", "แจกัน", "floral", "bouquet"],
    direct: ["Home Decor", "Interior Design", "Artificial Flowers", "Flower Arrangement"],
    indirect: ["Luxury Interior", "Architecture", "Furniture", "Home Renovation"],
    lifestyle: ["Luxury Shopping", "Premium Furniture", "Designer Brands"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["furniture", "sofa", "เฟอร์นิเจอร์", "home decor", "interior"],
    direct: ["Furniture", "Home Decor", "Interior Design"],
    indirect: ["Architecture", "Home Improvement", "Real Estate"],
    lifestyle: ["Luxury Goods", "Modern Design"],
    behavior: ["Engaged Shoppers", "Small Business Owners"],
  },
  {
    keywords: ["skincare", "beauty", "cosmetic", "ความงาม", "เครื่องสำอาง", "makeup"],
    direct: ["Cosmetics", "Skin Care", "Beauty Salons"],
    indirect: ["Fashion", "Health and Wellness"],
    lifestyle: ["Luxury Goods", "Online Shopping"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["fitness", "gym", "workout", "ออกกำลังกาย", "supplement"],
    direct: ["Physical Fitness", "Gym", "Bodybuilding"],
    indirect: ["Nutrition", "Yoga", "Running"],
    lifestyle: ["Healthy Lifestyle", "Outdoor Recreation"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["baby", "kids", "children", "เด็ก", "ทารก", "toy"],
    direct: ["Parenting", "Baby Products", "Toys"],
    indirect: ["Family", "Education"],
    lifestyle: ["Parents (Facebook category)"],
    behavior: ["New Parents (0-12 months)"],
  },
  {
    keywords: ["pet", "dog", "cat", "สัตว์เลี้ยง", "หมา", "แมว"],
    direct: ["Pet Supplies", "Dogs", "Cats"],
    indirect: ["Veterinary Medicine", "Animal Welfare"],
    lifestyle: ["Pet Owners (Facebook category)"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["electronic", "gadget", "smartphone", "อิเล็กทรอนิกส์", "โทรศัพท์"],
    direct: ["Consumer Electronics", "Smartphones", "Gadgets"],
    indirect: ["Technology", "Online Shopping"],
    lifestyle: ["Early Adopters of Technology"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["fashion", "clothing", "apparel", "แฟชั่น", "เสื้อผ้า", "dress"],
    direct: ["Fashion", "Clothing", "Boutiques"],
    indirect: ["Shopping", "Accessories"],
    lifestyle: ["Luxury Goods", "Fast Fashion"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["food", "restaurant", "cafe", "อาหาร", "ร้านอาหาร", "coffee"],
    direct: ["Food", "Restaurants", "Cooking"],
    indirect: ["Fine Dining", "Coffee"],
    lifestyle: ["Foodies"],
    behavior: ["Engaged Shoppers"],
  },
  {
    keywords: ["jewelry", "watch", "luxury", "เครื่องประดับ", "นาฬิกา", "หรูหรา"],
    direct: ["Jewellery", "Watches", "Luxury Goods"],
    indirect: ["Fashion Accessories", "Fine Jewelry"],
    lifestyle: ["Luxury Shopping", "Designer Brands"],
    behavior: ["Engaged Shoppers"],
  },
];

const GENERIC_FALLBACK: DictionaryEntry = {
  keywords: [],
  direct: ["Online Shopping", "Retail"],
  indirect: ["Small Business"],
  lifestyle: ["Engaged Shoppers"],
  behavior: ["Engaged Shoppers"],
};

function matchDictionary(text: string): DictionaryEntry[] {
  const lower = text.toLowerCase();
  const matched = DICTIONARY.filter((entry) => entry.keywords.some((k) => lower.includes(k.toLowerCase())));
  return matched.length > 0 ? matched : [GENERIC_FALLBACK];
}

function mergeUnique(entries: DictionaryEntry[], bucket: keyof DictionaryEntry): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    if (bucket === "keywords") continue;
    for (const v of e[bucket]) set.add(v);
  }
  return Array.from(set);
}

export interface InterestResult {
  name: string;
  available: boolean;
  reason?: string;
}

async function verifyBucket(
  adapter: MetaAdsAdapter | null,
  candidates: string[],
): Promise<InterestResult[]> {
  if (!adapter) {
    return candidates.map((name) => ({
      name,
      available: false,
      reason: "Connect a Meta ad account to verify targeting availability.",
    }));
  }

  const results: InterestResult[] = [];
  for (const name of candidates) {
    try {
      const match = await adapter.searchInterest(name);
      results.push(
        match
          ? { name: match.name, available: true }
          : { name, available: false, reason: "Unavailable for targeting" },
      );
    } catch {
      results.push({ name, available: false, reason: "Unavailable for targeting" });
    }
  }
  return results;
}

export async function discoverAudience(
  organizationId: string,
  input: { productName: string; productDescription: string; targetCustomer: string; price: number | null; country: string },
) {
  const combinedText = `${input.productName} ${input.productDescription} ${input.targetCustomer}`;
  const matched = matchDictionary(combinedText);

  const connection = await prisma.metaConnection.findFirst({
    where: { organizationId, status: "CONNECTED" },
  });
  const adapter = connection ? new MetaAdsAdapter(connection.accessToken) : null;

  const [direct, indirect, lifestyle, behavior] = await Promise.all([
    verifyBucket(adapter, mergeUnique(matched, "direct")),
    verifyBucket(adapter, mergeUnique(matched, "indirect")),
    verifyBucket(adapter, mergeUnique(matched, "lifestyle")),
    verifyBucket(adapter, mergeUnique(matched, "behavior")),
  ]);

  const suggestion = await prisma.audienceSuggestion.create({
    data: {
      organizationId,
      productName: input.productName,
      productDescription: input.productDescription,
      targetCustomer: input.targetCustomer,
      price: input.price,
      country: input.country,
      directInterests: direct as never,
      indirectInterests: indirect as never,
      lifestyleInterests: lifestyle as never,
      behaviorIntent: behavior as never,
    },
  });

  return suggestion;
}
