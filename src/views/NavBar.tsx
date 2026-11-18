import { useEffect, useState } from 'react';
import { Icon } from './Icons';

/**
 * Top bar of a screen opened from the menu: a back button with the menu's name, and the
 * screen's title, which shows small once the large title has scrolled away.
 */
export function NavBar({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = document.getElementById('screen-title');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [title]);
  return (
    <header className={`navbar ${compact ? 'compact' : ''}`}>
      <button type="button" className="nav-back" onClick={onBack}>
        <Icon name="chevronLeft" size={24} />
        {backLabel}
      </button>
      <span className="nav-title" aria-hidden={!compact}>
        {title}
      </span>
      <span className="nav-spacer" />
    </header>
  );
}
