import React, { useState, useEffect } from 'react';
import { BlogPost } from '../types';
import { fetchBlogPosts } from '../services/api';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const BlogView: React.FC = () => {
  const [posts, setPosts]         = useState<BlogPost[]>([]);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetchBlogPosts()
      .then(p => { setPosts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="max-w-md mx-auto pt-16 pb-24 px-4 text-center text-zinc-400 text-sm">
      Loading...
    </div>
  );

  return (
    <div className="max-w-md mx-auto pb-24 pt-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Dev Journey</h1>
        <p className="text-xs text-zinc-500">Building this app — one bug at a time</p>
      </div>

      {posts.map(post => {
        const isOpen = expanded === post.id;
        return (
          <article key={post.id} className="mb-4 bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Header row — always visible */}
            <button
              className="w-full text-left px-4 pt-4 pb-3"
              onClick={() => setExpanded(isOpen ? null : post.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                      {post.version}
                    </span>
                    <span className="text-[10px] text-zinc-400">{post.display_date}</span>
                  </div>
                  <p className="text-sm font-bold text-zinc-900 leading-snug">{post.emoji} {post.short_title}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">{post.summary}</p>
                </div>
                <div className="flex-shrink-0 mt-1 text-zinc-400">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </button>

            {/* Expanded body */}
            {isOpen && (
              <div className="px-4 pb-5 border-t border-zinc-100 pt-4">
                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full border border-zinc-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {/* Body HTML */}
                <div
                  className="blog-body text-xs text-zinc-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: post.body }}
                />
              </div>
            )}
          </article>
        );
      })}

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
