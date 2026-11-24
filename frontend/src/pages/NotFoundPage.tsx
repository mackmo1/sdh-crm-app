import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-title">Page not found</div>
        <p className="empty-text">The page you were looking for does not exist.</p>
        <Link className="btn btn-secondary" to="/properties">
          Back to properties
        </Link>
      </div>
    </div>
  );
}
