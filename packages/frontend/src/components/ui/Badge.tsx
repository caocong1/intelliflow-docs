type BadgeProps = {
  label: string;
  variant: "success" | "warning" | "error" | "info";
};

const variantClasses: Record<BadgeProps["variant"], string> = {
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
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
