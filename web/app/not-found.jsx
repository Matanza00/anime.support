export const metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="wrap section">
      <div className="glass empty">
        <p className="eyebrow">404</p>
        <h1 style={{ fontSize: 32, margin: '8px 0' }}>This page went isekai</h1>
        <p>It was transported to another world. Try the latest news instead.</p>
        <p style={{ marginTop: 18 }}><a className="btn" href="/">Back to latest news</a></p>
      </div>
    </div>
  );
}
