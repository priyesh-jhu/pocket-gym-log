import "./FAB.css";

export default function FAB({ icon, children, className = "", ...rest }) {
  return <button type="button" className={`m3-fab ${className}`.trim()} {...rest}>{icon}<span>{children}</span></button>;
}
