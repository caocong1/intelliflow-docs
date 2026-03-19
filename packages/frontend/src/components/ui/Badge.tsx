type BadgeProps = {
  label: string;
  variant: "success" | "warning" | "error" | "info";
};

const variantClasses: Record<BadgeProps["variant"], string> = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  error: "bg-red-50 text-red-600 ring-1 ring-red-200/60",
  info: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
};

export default function Badge(props: BadgeProps) {
  return (
    <span
      class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[props.variant]}`}
    >
      {props.label}
    </span>
  );
}
