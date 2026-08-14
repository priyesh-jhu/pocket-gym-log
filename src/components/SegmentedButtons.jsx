import "./SegmentedButtons.css";

export default function SegmentedButtons({ options, value, onChange, ariaLabel }) {
  return (
    <div className="m3-seg" role="group" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={String(option.value)}
          type="button"
          className="m3-seg__opt"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
