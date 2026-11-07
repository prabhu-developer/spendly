export default function DashboardLoading() {
  return (
    <div
      className="space-y-6"
      aria-label="Loading financial overview"
      aria-busy="true"
    >
      <div className="h-12 w-64 animate-pulse rounded-lg bg-white" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-[#E8EDF4] bg-white"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl border border-[#E8EDF4] bg-white lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl border border-[#E8EDF4] bg-white" />
        <div className="h-64 animate-pulse rounded-xl border border-[#E8EDF4] bg-white lg:col-span-3" />
      </div>
    </div>
  );
}
