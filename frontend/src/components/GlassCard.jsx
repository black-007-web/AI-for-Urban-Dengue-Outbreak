export default function GlassCard({ as: Tag = 'section', className = '', children, spotlight = true, ...rest }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <Tag onMouseMove={spotlight ? onMove : undefined} className={`glass rounded-2xl ${spotlight ? 'spot' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
