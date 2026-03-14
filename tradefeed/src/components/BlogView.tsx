import React, { useState, useEffect, useRef } from 'react';
import { BlogPost } from '../types';
import { fetchBlogPosts } from '../services/api';

// Rewrite relative image src paths to absolute so they work from /mobile/
function fixImageUrls(html: string): string {
  return html.replace(/src="([^"]+)"/g, (match, src) => {
    if (src.startsWith('http') || src.startsWith('//') || src.startsWith('/static')) return match;
    const cleaned = src.replace(/^\//, '');
    return `src="/${cleaned}"`;
  });
}

export const BlogView: React.FC = () => {
  const [posts, setPosts]   = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const postRefs     = useRef<Record<string, HTMLElement | null>>({});

  // Timeline scrub state
  const [thumbY, setThumbY]     = useState<number | null>(null);
  const [scrubLabel, setScrubLabel] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBlogPosts()
      .then(p => { setPosts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-md mx-auto pt-16 pb-24 px-4 text-center text-zinc-400 text-sm">Loading...</div>
  );

  // Build unique year-month labels for timeline
  const timelineDates = posts
    .map(p => p.date ? p.date.slice(0, 7) : '')
    .filter((v, i, a) => v && a.indexOf(v) === i);

  const handleTimelineMove = (clientY: number) => {
    const el = timelineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const idx  = Math.round(pct * (timelineDates.length - 1));
    const label = timelineDates[idx];
    setThumbY(pct * rect.height);
    setScrubLabel(label);
    // Scroll to matching post
    const matchPost = posts.find(p => p.date && p.date.startsWith(label));
    if (matchPost && postRefs.current[matchPost.id]) {
      postRefs.current[matchPost.id]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="relative">
      {/* Main scrollable content */}
      <div className="max-w-md mx-auto pb-24 pt-6 px-4 pr-10" ref={containerRef}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Dev Journey</h1>
          <p className="text-xs text-zinc-500">Building this app — one bug at a time</p>
        </div>

        {posts.map(post => (
          <article
            key={post.id}
            ref={el => { postRefs.current[post.id] = el; }}
            className="mb-5 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm"
          >
            {/* Header — always visible */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  {post.version}
                </span>
                <span className="text-[10px] text-zinc-400">{post.display_date}</span>
              </div>
              <p className="text-sm font-bold text-zinc-900 leading-snug">{post.emoji} {post.short_title}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{post.summary}</p>
            </div>

            {/* Full body — always expanded */}
            <div className="px-4 pb-5 border-t border-zinc-100 pt-4">
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {post.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full border border-zinc-200">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="blog-body text-xs text-zinc-600 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: fixImageUrls(post.body) }}
              />
            </div>
          </article>
        ))}
      </div>

      {/* Google Photos–style date timeline — right side */}
      <div
        ref={timelineRef}
        className="fixed top-0 right-0 bottom-20 w-8 flex flex-col items-center justify-between py-16 z-20 cursor-pointer"
        onMouseMove={e => handleTimelineMove(e.clientY)}
        onMouseLeave={() => { setThumbY(null); setScrubLabel(null); }}
        onTouchMove={e => handleTimelineMove(e.touches[0].clientY)}
        onTouchEnd={() => { setThumbY(null); setScrubLabel(null); }}
      >
        {/* Year ticks */}
        {timelineDates.map((ym, i) => {
          const isYear = ym.endsWith('-01') || i === 0;
          return (
            <div
              key={ym}
              className={`w-1 rounded-full transition-all ${isYear ? 'h-2 bg-zinc-400' : 'h-1 bg-zinc-200'}`}
              onClick={() => {
                const matchPost = posts.find(p => p.date && p.date.startsWith(ym));
                if (matchPost && postRefs.current[matchPost.id]) {
                  postRefs.current[matchPost.id]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            />
          );
        })}

        {/* Thumb indicator */}
        {thumbY !== null && (
          <div
            className="absolute right-1 pointer-events-none flex items-center gap-1"
            style={{ top: thumbY - 10 }}
          >
            {scrubLabel && (
              <span className="text-[10px] font-bold text-white bg-zinc-800 px-2 py-0.5 rounded whitespace-nowrap -translate-x-full">
                {new Date(scrubLabel + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
              </span>
            )}
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 border-2 border-white shadow" />
          </div>
        )}
      </div>

      <style>{`
        .blog-body p { margin-bottom: 10px; }
        .blog-body h3 { font-size: 0.82rem; font-weight: 700; color: #18181b; margin: 14px 0 6px; }
        .blog-body strong { color: #18181b; }
        .blog-body em { color: #f97316; font-style: italic; }
        .blog-body a { color: #4f46e5; }
        .blog-body ul, .blog-body ol { padding-left: 16px; margin-bottom: 10px; }
        .blog-body li { margin-bottom: 4px; }
        .blog-body code { background: #f4f4f5; color: #16a34a; padding: 1px 4px; border-radius: 3px; font-size: 0.8em; }
        .blog-body pre { background: #f4f4f5; border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin-bottom: 10px; font-size: 0.75em; }
        .blog-body pre code { background: none; padding: 0; }
        .blog-body img { max-width: 100%; width: 100%; height: auto; border-radius: 8px; margin: 10px 0; display: block; }
        .blog-body .img-caption { text-align: center; font-size: 0.7rem; color: #71717a; margin-top: -6px; margin-bottom: 10px; font-style: italic; }
      `}</style>
    </div>
  );
};
