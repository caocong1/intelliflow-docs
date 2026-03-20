import Badge from "../ui/Badge";

type VisibilityBadgeProps = {
  visibility: "self" | "project" | "specific";
};

const visibilityConfig: Record<
  VisibilityBadgeProps["visibility"],
  { label: string; variant: "success" | "warning" | "error" | "info" }
> = {
  self: { label: "仅自己", variant: "error" },
  project: { label: "项目成员", variant: "info" },
  specific: { label: "指定成员", variant: "warning" },
};

export default function VisibilityBadge(props: VisibilityBadgeProps) {
  const config = () => visibilityConfig[props.visibility];
  return <Badge label={config().label} variant={config().variant} />;
}
