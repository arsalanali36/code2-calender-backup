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

  useEffect(() => {
    fetchBlogPosts()
      .then(p => { setPosts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-md mx-auto pt-16 pb-24 px-4 text-center text-zinc-500 text-sm">Loading...</div>
  );

  return (
    <div className="relative min-h-screen bg-zinc-950">
      {/* Main scrollable content */}
      <div className="max-w-md mx-auto pb-24 pt-6 px-4" ref={containerRef}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Dev Journal</h1>
            <span className="text-[11px] text-zinc-500 font-bold">{posts.length} entries</span>
          </div>
          <div className="relative">
            <select
              className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-xl px-3 py-2 outline-none appearance-none cursor-pointer"
              defaultValue=""
              onChange={e => {
                const id = e.target.value;
                if (id && postRefs.current[id]) {
                  postRefs.current[id]!.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                e.target.value = '';
              }}
            >
              <option value="" disabled>Jump to entry...</option>
              {posts.map(p => (
                <option key={p.id} value={p.id}>{p.display_date} — {p.short_title}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">▾</div>
          </div>
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
                  {post.display_date}
                </span>
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
