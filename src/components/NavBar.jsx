import "./NavBar.css";

export default function NavBar({ items, active, onChange }) {
  return (
    <nav className="m3-navbar">
      {items.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            className={`m3-navbar__item${isActive ? " is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            <span className="m3-navbar__pill">
              <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} />
            </span>
            <span className="m3-navbar__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
