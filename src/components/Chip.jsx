import "./Chip.css";

export default function Chip({
  as = "span", selected = false, className = "", children, ...rest
}) {
  const Tag = as;
  const classes = [
    "m3-chip",
    as === "button" ? "m3-chip--button" : "",
    selected ? "m3-chip--selected" : "",
    className,
  ].filter(Boolean).join(" ");
  const extra = as === "button"
    ? { type: "button", "aria-pressed": selected }
    : {};
  return <Tag className={classes} {...extra} {...rest}>{children}</Tag>;
}
