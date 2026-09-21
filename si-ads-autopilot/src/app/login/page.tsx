import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-primary-deep">SI Ads Autopilot</h1>
        <p className="mt-1 text-sm text-secondary-text">Sign in to your workspace</p>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
