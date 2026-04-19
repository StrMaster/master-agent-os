type ActionButtonProps = {
  label: string;
  variant?: "primary" | "secondary";
};

export default function ActionButton({
  label,
  variant = "secondary",
}: ActionButtonProps) {
  if (variant === "primary") {
    return (
      <button className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-cyan-400">
        {label}
      </button>
    );
  }

  return (
    <button className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
      {label}
    </button>
  );
}