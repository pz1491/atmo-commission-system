import { RuleBuilderForm } from "./rule-builder-form";

export default function NewRulePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-[28px] font-semibold">New Automation Rule</h1>
      <RuleBuilderForm />
    </div>
  );
}
