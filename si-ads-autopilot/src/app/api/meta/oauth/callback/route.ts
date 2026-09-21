import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { META_GRAPH_API_VERSION } from "@/services/meta";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MeResponse {
  id: string;
}

interface AdAccountResponse {
  data: Array<{
    id: string;
    account_id: string;
    name: string;
    currency: string;
    timezone_name: string;
  }>;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error_description");
  if (error) {
    return NextResponse.redirect(
      new URL(`/onboarding?meta_error=${encodeURIComponent(error)}`, req.nextUrl.origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/onboarding?meta_error=missing_code", req.nextUrl.origin));
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "META_APP_ID / META_APP_SECRET not configured." }, { status: 501 });
  }

  const redirectUri = new URL("/api/meta/oauth/callback", req.nextUrl.origin).toString();
  const base = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

  try {
    const tokenRes = await fetch(
      `${base}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          redirect_uri: redirectUri,
          client_secret: appSecret,
          code,
        }),
    );
    const shortLived = (await tokenRes.json()) as TokenResponse & { error?: { message: string } };
    if (!tokenRes.ok || !shortLived.access_token) {
      throw new Error(shortLived.error?.message ?? "Failed to exchange code for token");
    }

    // Exchange for a long-lived token (~60 days) so we're not re-prompting daily.
    const longLivedRes = await fetch(
      `${base}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLived.access_token,
        }),
    );
    const longLived = (await longLivedRes.json()) as TokenResponse & { error?: { message: string } };
    const accessToken = longLived.access_token ?? shortLived.access_token;
    const expiresInSec = longLived.expires_in ?? shortLived.expires_in;

    const meRes = await fetch(`${base}/me?fields=id&access_token=${accessToken}`);
    const me = (await meRes.json()) as MeResponse;

    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
    }

    const connection = await prisma.metaConnection.upsert({
      where: {
        organizationId_metaUserId: {
          organizationId: membership.organizationId,
          metaUserId: me.id,
        },
      },
      create: {
        organizationId: membership.organizationId,
        metaUserId: me.id,
        accessToken,
        tokenExpiresAt: expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null,
        scopes: ["ads_management", "ads_read", "business_management"],
        status: "CONNECTED",
      },
      update: {
        accessToken,
        tokenExpiresAt: expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null,
        status: "CONNECTED",
        lastError: null,
      },
    });

    // Pull the real list of ad accounts this token can manage (Onboarding step 2).
    const adAccountsRes = await fetch(
      `${base}/me/adaccounts?fields=id,account_id,name,currency,timezone_name&access_token=${accessToken}`,
    );
    const adAccounts = (await adAccountsRes.json()) as AdAccountResponse;

    if (Array.isArray(adAccounts.data)) {
      for (const acc of adAccounts.data) {
        await prisma.adAccount.upsert({
          where: { externalId: acc.id },
          create: {
            metaConnectionId: connection.id,
            externalId: acc.id,
            name: acc.name,
            currency: acc.currency,
            timezone: acc.timezone_name,
          },
          update: {
            name: acc.name,
            currency: acc.currency,
            timezone: acc.timezone_name,
            metaConnectionId: connection.id,
          },
        });
      }
    }

    return NextResponse.redirect(new URL("/onboarding?meta_connected=1", req.nextUrl.origin));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/onboarding?meta_error=${encodeURIComponent(message)}`, req.nextUrl.origin),
    );
  }
}
