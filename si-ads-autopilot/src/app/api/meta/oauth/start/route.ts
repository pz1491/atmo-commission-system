import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { META_GRAPH_API_VERSION } from "@/services/meta";

// Kicks off the Meta Business OAuth dialog (spec Onboarding step 1).
// Required scopes for reading insights and writing budget/status changes.
const SCOPES = ["ads_management", "ads_read", "business_management"].join(",");

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json(
      {
        error:
          "META_APP_ID is not configured. Set META_APP_ID / META_APP_SECRET in your environment to enable Meta connection.",
      },
      { status: 501 },
    );
  }

  const redirectUri = new URL("/api/meta/oauth/callback", req.nextUrl.origin).toString();
  const state = session.user.id;

  const authUrl = new URL(
    `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`,
  );
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
