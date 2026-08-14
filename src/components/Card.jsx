import "./Card.css";

export default function Card({ variant = "filled", className = "", children, ...rest }) {
  return (
    <div className={`m3-card m3-card--${variant} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
