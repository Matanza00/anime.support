export default function StaticPage({ eyebrow, title, children }) {
  return (
    <div className="wrap">
      <header className="page-head">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </header>
      <div className="page-body glass"><div className="prose">{children}</div></div>
    </div>
  );
}
