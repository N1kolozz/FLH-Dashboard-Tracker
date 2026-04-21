import { WEEKDAYS, type CalendarView } from "@/features/social/calendar/model";

export function LoadingStatCards() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
        >
          <div className="h-3 w-20 rounded-full bg-slate-200" />
          <div className="mt-3 h-9 w-16 rounded-2xl bg-slate-200" />
          <div className="mt-2 h-4 w-32 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function CalendarDataSkeleton({
  calendarView,
  isFitLayout,
}: {
  calendarView: CalendarView;
  isFitLayout: boolean;
}) {
  const isMonthView = calendarView === "month";
  const containerClassName = isMonthView
    ? isFitLayout
      ? "w-full"
      : "min-w-[940px]"
    : isFitLayout
      ? "w-full"
      : "min-w-[1180px]";
  const cellClassName = isMonthView
    ? isFitLayout
      ? "min-h-[82px] sm:min-h-[108px]"
      : "min-h-[150px]"
    : isFitLayout
      ? "min-h-[150px] sm:min-h-[200px]"
      : "min-h-[280px]";
  const cellCount = isMonthView ? 35 : 7;

  return (
    <div className={isFitLayout ? "" : "overflow-x-auto pb-1"}>
      <div
        className={`${containerClassName} overflow-hidden rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-sm`}
      >
        <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-100/90">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className={`${isFitLayout ? "px-1 py-2 sm:px-2" : "px-4 py-3"} text-center`}
            >
              <div className="mx-auto h-3 w-10 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: cellCount }).map((_, idx) => (
            <div
              key={idx}
              className={`${cellClassName} animate-pulse border-b border-r border-slate-200/70 bg-white px-3 py-3`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="h-8 w-8 rounded-2xl bg-slate-200" />
                <div className="space-y-1">
                  <div className="h-3 w-10 rounded-full bg-slate-100" />
                  <div className="h-3 w-8 rounded-full bg-slate-100" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-8 rounded-xl bg-slate-100" />
                <div className="h-8 rounded-xl bg-slate-100/80" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
