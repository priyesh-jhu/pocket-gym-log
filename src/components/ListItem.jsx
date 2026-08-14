import "./ListItem.css";

export default function ListItem({ title, subtitle, trailing, className = "" }) {
  return (
    <div className={`m3-list-item ${className}`.trim()}>
      <div className="m3-list-item__body">
        <div className="m3-list-item__title">{title}</div>
        {subtitle && <div className="m3-list-item__sub">{subtitle}</div>}
      </div>
      {trailing && <div className="m3-list-item__trailing">{trailing}</div>}
    </div>
  );
}
