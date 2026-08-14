import { useId } from "react";
import "./TextField.css";

export default function TextField({ label, id, className = "", ...rest }) {
  const generated = useId();
  const fieldId = id || generated;
  return (
    <div className={`m3-field ${className}`.trim()}>
      {label && <label className="m3-field__label" htmlFor={fieldId}>{label}</label>}
      <input id={fieldId} className="m3-field__input" {...rest} />
    </div>
  );
}
