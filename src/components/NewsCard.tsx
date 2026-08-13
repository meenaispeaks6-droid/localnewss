import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Clock, Undo2 } from "lucide-react";
import { categoryHi, type Lang, type NewsArticle } from "@/lib/newsTypes";
import { articlePath } from "@/lib/geo";

const timeAgo = (iso: string, lang: Lang) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return lang === "hi" ? `${mins} मिनट पहले` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === "hi" ? `${hrs} घंटे पहले` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return lang === "hi" ? `${days} दिन पहले` : `${days}d ago`;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const NewsCard = ({
  article,
  index,
  lang,
  read = false,
  onToggleRead,
}: {
  article: NewsArticle;
  index: number;
  lang: Lang;
  read?: boolean;
  onToggleRead?: (id: string, read: boolean) => void;
}) => {
  const title = lang === "hi" ? article.title_hi || article.title_en : article.title_en;
  const summary =
    lang === "hi" ? article.summary_hi || article.summary_en : article.summary_en;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      className={`group relative flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring ${
        read ? "border-border/60 opacity-70" : "border-border"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!read && (
          <span
            aria-label={lang === "hi" ? "नई ख़बर" : "Unread"}
            className="h-2 w-2 shrink-0 rounded-full bg-primary"
          />
        )}
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {lang === "hi" ? categoryHi[article.category] ?? article.category : article.category}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <time dateTime={article.published_at}>{timeAgo(article.published_at, lang)}</time>
        </span>
      </div>

      <h3 className="font-heading text-base font-semibold leading-snug tracking-tight sm:text-lg">
        {article.slug ? (
          <Link
            to={articlePath(article.city, article.slug, lang)}
            onClick={() => onToggleRead?.(article.id, true)}
            className="outline-none transition-colors group-hover:text-primary"
          >
            {/* full-card click target */}
            <span className="absolute inset-0 rounded-2xl" aria-hidden="true" />
            {title}
          </Link>
        ) : (
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onToggleRead?.(article.id, true)}
            className="outline-none transition-colors group-hover:text-primary"
          >
            <span className="absolute inset-0 rounded-2xl" aria-hidden="true" />
            {title}
          </a>
        )}
      </h3>


      {summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {summary}
        </p>
      )}

      <footer className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="truncate">{article.source_name ?? hostOf(article.source_url)}</span>
        <span className="relative z-10 flex shrink-0 items-center gap-1">
          {onToggleRead && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleRead(article.id, !read);
              }}
              aria-label={
                read
                  ? lang === "hi"
                    ? "अपठित करें"
                    : "Mark as unread"
                  : lang === "hi"
                    ? "पढ़ा हुआ करें"
                    : "Mark as read"
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:border-primary/40 hover:text-primary"
            >
              {read ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </button>
          )}
          <ArrowUpRight
            className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </span>
      </footer>
    </motion.article>
  );
};

export default NewsCard;
