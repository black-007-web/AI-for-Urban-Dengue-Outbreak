import Icon from './Icon';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div role="alert" className="glass rounded-2xl p-6 flex flex-col items-start gap-3 border-l-4" style={{ borderLeftColor: '#e11d48' }}>
      <div className="flex items-center gap-2 font-display font-bold text-lg">
        <Icon name="alert" className="text-coral" /> {title}
      </div>
      <p className="text-sm text-muted max-w-prose">{message || 'The request did not complete. Check that the backend is running and try again.'}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg bg-lagoon text-canvas px-3 py-1.5 text-sm font-semibold hover:opacity-90">
          <Icon name="refresh" size={16} /> Retry
        </button>
      )}
    </div>
  );
}
