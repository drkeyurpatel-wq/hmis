export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading...</p>
    </div>
  );
}
