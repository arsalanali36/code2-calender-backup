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
  const [posts, setPosts]     = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const postRefs     = useRef<Record<string, HTMLElement | null>>({});

  const [thumbY, setThumbY]         = useState<number | null>(null);
  const [scrubLabel, setScrubLabel] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBlogPosts()
      .then(p => { setPosts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-md mx-auto pt-16 pb-24 px-4 text-center text-zinc-500 text-sm">Loading...</div>
  );

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
    const matchPost = posts.find(p => p.date && p.date.startsWith(label));
    if (matchPost && postRefs.current[matchPost.id]) {
      postRefs.current[matchPost.id]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950">
      {/* Main scrollable content */}
      <div className="max-w-md mx-auto pb-24 pt-6 px-4 pr-10" ref={containerRef}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Dev Journey</h1>
          <p className="text-xs text-zinc-500">Building this app — one bug at a time</p>
        </div>

        {posts.map(post => (
          <article
            key={post.id}
            ref={el => { postRefs.current[post.id] = el; }}
            className="mb-5 bg-zinc-900 rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  {post.version}
                </span>
                <span className="text-[10px] text-zinc-500">{post.display_date}</span>
              </div>
              <p className="text-sm font-bold text-white leading-snug">{post.emoji} {post.short_title}</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{post.summary}</p>
            </div>

            {/* Full body */}
            <div className="px-4 pb-5 border-t border-zinc-800 pt-4">
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {post.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div
                className="blog-body text-xs text-zinc-400 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: fixImageUrls(post.body) }}
              />
            </div>
          </article>
        ))}
      </div>

      {/* Timeline scrubber */}
      <div
        ref={timelineRef}
        className="fixed top-0 right-0 bottom-20 w-8 flex flex-col items-center justify-between py-16 z-20 cursor-pointer"
        onMouseMove={e => handleTimelineMove(e.clientY)}
        onMouseLeave={() => { setThumbY(null); setScrubLabel(null); }}
        onTouchMove={e => handleTimelineMove(e.touches[0].clientY)}
        onTouchEnd={() => { setThumbY(null); setScrubLabel(null); }}
      >
        {timelineDates.map((ym, i) => {
          const isYear = ym.endsWith('-01') || i === 0;
          return (
            <div
              key={ym}
              className={`w-1 rounded-full transition-all ${isYear ? 'h-2 bg-zinc-600' : 'h-1 bg-zinc-700'}`}
              onClick={() => {
                const matchPost = posts.find(p => p.date && p.date.startsWith(ym));
                if (matchPost && postRefs.current[matchPost.id]) {
                  postRefs.current[matchPost.id]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            />
          );
        })}

        {thumbY !== null && (
          <div
            className="absolute right-1 pointer-events-none flex items-center gap-1"
            style={{ top: thumbY - 10 }}
          >
            {scrubLabel && (
              <span className="text-[10px] font-bold text-white bg-zinc-700 px-2 py-0.5 rounded whitespace-nowrap -translate-x-full">
                {new Date(scrubLabel + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
              </span>
            )}
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-400 border-2 border-zinc-900 shadow" />
          </div>
        )}
      </div>

      <style>{`
        .blog-body p { margin-bottom: 10px; }
        .blog-body h3 { font-size: 0.82rem; font-weight: 700; color: #e4e4e7; margin: 14px 0 6px; }
        .blog-body strong { color: #e4e4e7; }
        .blog-body em { color: #f97316; font-style: italic; }
        .blog-body a { color: #818cf8; }
        .blog-body ul, .blog-body ol { padding-left: 16px; margin-bottom: 10px; }
        .blog-body li { margin-bottom: 4px; }
        .blog-body code { background: #27272a; color: #4ade80; padding: 1px 4px; border-radius: 3px; font-size: 0.8em; }
        .blog-body pre { background: #18181b; border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin-bottom: 10px; font-size: 0.75em; border: 1px solid #3f3f46; }
        .blog-body pre code { background: none; padding: 0; }
        .blog-body img { max-width: 100%; width: 100%; height: auto; border-radius: 8px; margin: 10px 0; display: block; }
        .blog-body .img-caption { text-align: center; font-size: 0.7rem; color: #71717a; margin-top: -6px; margin-bottom: 10px; font-style: italic; }
      `}</style>
    </div>
  );
};
