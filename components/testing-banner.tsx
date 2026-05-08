import { isTestingMode } from "@/lib/data/testing";
import { disableTestingAction } from "@/app/actions/testing";

export function TestingBanner() {
  if (!isTestingMode()) return null;
  return (
    <div className="w-full bg-red-600 text-white text-xs font-medium flex items-center justify-center gap-4 py-1.5 px-4 shrink-0">
      <span>&#9888; TESTING MODE &#8212; all data is synthetic</span>
      <form action={disableTestingAction}>
        <button type="submit" className="underline hover:no-underline">
          Disable
        </button>
      </form>
    </div>
  );
}
