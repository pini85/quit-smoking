import { Card } from "@/components/ui/Card";

// Placeholder Today screen — Task 13 replaces this with the real one.
export default function TodayPage() {
  return (
    <div className="flex flex-col gap-6 pt-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Unsmoke</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Private, local-first quit-smoking companion
        </p>
      </header>

      <Card>
        <p className="text-sm text-ink-muted">Home coming soon</p>
      </Card>
    </div>
  );
}
