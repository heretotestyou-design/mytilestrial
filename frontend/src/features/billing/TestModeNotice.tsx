import { Icon } from "@/components/ui/Icon";

export function TestModeNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-900">
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <b className="font-semibold">Test mode.</b> No real money is charged. Images are added to your balance as soon as you confirm.
      </p>
    </div>
  );
}
