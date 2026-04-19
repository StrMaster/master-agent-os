type StatCardProps = {
  label: string;
  value: string;
  subtext: string;
};

export default function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{subtext}</p>
    </div>
  );
}