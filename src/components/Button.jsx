import "./Button.css";

export default function Button({
  variant = "filled", block = false, icon = null,
  className = "", children, ...rest
}) {
  const classes = [
    "m3-btn", `m3-btn--${variant}`,
    block ? "m3-btn--block" : "", className,
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}
