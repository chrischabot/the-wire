import { useState, useEffect, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Repeat2,
  Heart,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Ban,
  ExternalLink,
} from "lucide-react";
import type { Post } from "../../lib/api";
import { postsApi, socialApi } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import {
  formatTimeAgo,
  linkifyContent,
  extractFirstUrl,
  getYouTubeId,
} from "../../utils/format";
import { ImageModal } from "../layout";

interface UnfurlData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  type?: string;
}

const linkCardStyles = {
  container: {
    marginTop: "12px",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "16px",
    overflow: "hidden",
    cursor: "pointer",
    transition: "background 0.2s",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  image: {
    width: "100%",
    maxWidth: "100%",
    height: "200px",
    objectFit: "cover" as const,
    display: "block",
  } as React.CSSProperties,
  smallImage: {
    width: "100px",
    minWidth: "100px",
    maxWidth: "100px",
    height: "100px",
    objectFit: "cover" as const,
    flexShrink: 0,
  } as React.CSSProperties,
  content: {
    padding: "12px",
    minWidth: 0,
    overflow: "hidden",
  } as React.CSSProperties,
  domain: {
    fontSize: "13px",
    color: "var(--muted-foreground, #718096)",
    marginBottom: "4px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  } as React.CSSProperties,
  title: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--foreground, #2d3748)",
    marginBottom: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    wordBreak: "break-word" as const,
  } as React.CSSProperties,
  description: {
    fontSize: "14px",
    color: "var(--muted-foreground, #718096)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
    wordBreak: "break-word" as const,
  } as React.CSSProperties,
  smallContainer: {
    marginTop: "12px",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "16px",
    overflow: "hidden",
    cursor: "pointer",
    display: "flex",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  youtubeContainer: {
    marginTop: "12px",
    borderRadius: "16px",
    overflow: "hidden",
    aspectRatio: "16 / 9",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  youtubeIframe: {
    width: "100%",
    height: "100%",
    border: "none",
  } as React.CSSProperties,
};

const unfurlCache = new Map<string, UnfurlData | null>();
const unfurlPending = new Map<string, Promise<UnfurlData | null>>();

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div
      style={linkCardStyles.youtubeContainer}
      onClick={(e) => e.stopPropagation()}
    >
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        style={linkCardStyles.youtubeIframe}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    </div>
  );
}

function LinkCard({ url }: { url: string }) {
  const [data, setData] = useState<UnfurlData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchUnfurl() {
      if (unfurlCache.has(url)) {
        const cached = unfurlCache.get(url);
        if (!cancelled) {
          setData(cached ?? null);
          setLoading(false);
        }
        return;
      }

      if (unfurlPending.has(url)) {
        const result = await unfurlPending.get(url);
        if (!cancelled) {
          setData(result ?? null);
          setLoading(false);
        }
        return;
      }

      const fetchPromise = (async (): Promise<UnfurlData | null> => {
        try {
          const response = await fetch(
            `/api/unfurl?url=${encodeURIComponent(url)}`,
          );
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              return result.data;
            }
          }
        } catch {
          /* silently fail */
        }
        return null;
      })();

      unfurlPending.set(url, fetchPromise);
      const result = await fetchPromise;
      unfurlCache.set(url, result);
      unfurlPending.delete(url);

      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }

    fetchUnfurl();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading || !data || (!data.title && !data.image)) {
    return null;
  }

  const hostname = new URL(url).hostname.replace(/^www\./, "");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={linkCardStyles.container} onClick={handleClick}>
      {data.image && (
        <img src={data.image} alt="" style={linkCardStyles.image} />
      )}
      <div style={linkCardStyles.content}>
        <div style={linkCardStyles.domain}>
          <ExternalLink size={12} />
          {hostname}
        </div>
        {data.title && <div style={linkCardStyles.title}>{data.title}</div>}
        {data.description && (
          <div style={linkCardStyles.description}>{data.description}</div>
        )}
      </div>
    </div>
  );
}

interface PostCardProps {
  post: Post;
  showActions?: boolean;
  showMenu?: boolean;
  onDelete?: (postId: string) => void;
}

function arePropsEqual(prev: PostCardProps, next: PostCardProps): boolean {
  const p = prev.post;
  const n = next.post;
  return (
    p.id === n.id &&
    p.likeCount === n.likeCount &&
    p.replyCount === n.replyCount &&
    p.repostCount === n.repostCount &&
    p.hasLiked === n.hasLiked &&
    p.hasReposted === n.hasReposted &&
    prev.showActions === next.showActions &&
    prev.showMenu === next.showMenu
  );
}

export const PostCard = memo(function PostCard({
  post,
  showActions = true,
  showMenu = true,
  onDelete,
}: PostCardProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const isPureRepost = !!post.repostOfId && !post.content && post.originalPost;
  const displayPost = isPureRepost ? post.originalPost! : post;

  const [isLiked, setIsLiked] = useState(displayPost.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(displayPost.likeCount);
  const [isReposted, setIsReposted] = useState(
    displayPost.hasReposted ?? false,
  );
  const [repostCount, setRepostCount] = useState(displayPost.repostCount);

  const isOwnPost =
    currentUser?.handle?.toLowerCase() ===
    displayPost.authorHandle?.toLowerCase();
  const isOwnRepost =
    isPureRepost &&
    currentUser?.handle?.toLowerCase() === post.authorHandle?.toLowerCase();

  const firstUrl = extractFirstUrl(displayPost.content);
  const youtubeId = firstUrl ? getYouTubeId(firstUrl) : null;
  const hasMedia = displayPost.mediaUrls && displayPost.mediaUrls.length > 0;
  const showLinkCard = firstUrl && !hasMedia && !isPureRepost;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const handleCardClick = () => {
    navigate(`/post/${isPureRepost ? displayPost.id : post.id}`);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Redirect to auth if not logged in
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));

    try {
      if (wasLiked) {
        await postsApi.unlike(displayPost.id);
      } else {
        await postsApi.like(displayPost.id);
      }
    } catch {
      setIsLiked(wasLiked);
      setLikeCount((c) => (wasLiked ? c + 1 : c - 1));
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Redirect to auth if not logged in
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    const wasReposted = isReposted;
    setIsReposted(!wasReposted);
    setRepostCount((c) => (wasReposted ? c - 1 : c + 1));

    try {
      if (wasReposted) {
        await postsApi.unrepost(displayPost.id);
      } else {
        await postsApi.repost(displayPost.id);
      }
    } catch {
      setIsReposted(wasReposted);
      setRepostCount((c) => (wasReposted ? c + 1 : c - 1));
    }
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Redirect to auth if not logged in
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    navigate(`/post/${displayPost.id}?reply=true`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this post? This cannot be undone.")) return;

    try {
      await postsApi.delete(post.id);
      onDelete?.(post.id);
    } catch {
      alert("Failed to delete post");
    }
    setMenuOpen(false);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isFollowing) {
        await socialApi.unfollow(displayPost.authorHandle);
      } else {
        await socialApi.follow(displayPost.authorHandle);
      }
      setIsFollowing(!isFollowing);
    } catch {
      /* silently fail - UX continues regardless */
    }
    setMenuOpen(false);
  };

  const handleBlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `Block @${displayPost.authorHandle}? They won't be able to see your posts.`,
      )
    )
      return;

    try {
      await socialApi.block(displayPost.authorHandle);
      window.location.reload();
    } catch {
      alert("Failed to block user");
    }
    setMenuOpen(false);
  };

  const isReply = !!displayPost.replyToId && !isPureRepost;

  return (
    <>
      {isPureRepost && (
        <div className="repost-indicator">
          <Repeat2 size={14} /> {post.authorDisplayName} reposted
        </div>
      )}
      {isReply && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            paddingLeft: "39px",
            height: "12px",
          }}
        >
          <div
            style={{
              width: "2px",
              height: "100%",
              backgroundColor: "var(--border)",
            }}
          />
        </div>
      )}
      <div
        className="post-card"
        data-post-id={post.id}
        onClick={handleCardClick}
        style={{ overflow: "hidden" }}
      >
        <div className="post-header" style={{ overflow: "hidden" }}>
          <Link
            to={`/u/${displayPost.authorHandle}`}
            onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0 }}
          >
            {displayPost.authorAvatarUrl ? (
              <img
                src={displayPost.authorAvatarUrl}
                className="avatar media-zoomable"
                data-fullsrc={displayPost.authorAvatarUrl}
                data-zoomable="true"
                alt={displayPost.authorDisplayName}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="avatar"
                style={{ background: "var(--primary)" }}
              />
            )}
          </Link>

          <div
            className="post-body"
            style={{ minWidth: 0, overflow: "hidden" }}
          >
            <div
              className="post-header-top"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  minWidth: 0,
                  flex: 1,
                  flexWrap: "nowrap",
                  gap: "4px",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    maxWidth: "45%",
                    fontWeight: 700,
                    color: "var(--foreground)",
                  }}
                >
                  <Link
                    to={`/u/${displayPost.authorHandle}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {displayPost.authorDisplayName}
                  </Link>
                </span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flexShrink: 1,
                    minWidth: 0,
                    color: "var(--muted-foreground)",
                  }}
                >
                  <Link
                    to={`/u/${displayPost.authorHandle}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    @{displayPost.authorHandle}
                  </Link>
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    color: "var(--muted-foreground)",
                  }}
                >
                  ·{" "}
                  {formatTimeAgo(
                    new Date(displayPost.createdAt || post.createdAt),
                  )}
                </span>
              </div>

              {showMenu && isAuthenticated && (
                <div className="post-menu-container" style={{ flexShrink: 0 }}>
                  <button
                    className="post-more-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(!menuOpen);
                    }}
                    aria-label="More options"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {menuOpen && (
                    <div className="post-dropdown open">
                      {isOwnPost || isOwnRepost ? (
                        <button
                          className="post-dropdown-item destructive"
                          onClick={handleDelete}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      ) : (
                        <>
                          <button
                            className={`post-dropdown-item follow-btn ${isFollowing ? "following" : ""}`}
                            onClick={handleFollow}
                          >
                            <UserPlus size={16} />
                            <span className="follow-text">
                              {isFollowing ? "Unfollow" : "Follow"} @
                              {displayPost.authorHandle}
                            </span>
                          </button>
                          <button
                            className="post-dropdown-item destructive"
                            onClick={handleBlock}
                          >
                            <Ban size={16} />
                            Block @{displayPost.authorHandle}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {displayPost.replyToHandle && (
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--muted-foreground)",
                  marginBottom: "4px",
                }}
              >
                Replying to{" "}
                <Link
                  to={`/u/${displayPost.replyToHandle}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "var(--primary)", textDecoration: "none" }}
                >
                  @{displayPost.replyToHandle}
                </Link>
              </div>
            )}

            {displayPost.content && (
              <div
                className="post-content"
                dangerouslySetInnerHTML={{
                  __html: linkifyContent(displayPost.content),
                }}
              />
            )}

            {displayPost.mediaUrls && displayPost.mediaUrls.length > 0 && (
              <div
                className="post-media"
                style={{
                  marginTop: "12px",
                  borderRadius: "16px",
                  overflow: "hidden",
                }}
              >
                {displayPost.mediaUrls.map((url, i) =>
                  url.match(/\.(mp4|webm|mov)$/i) ? (
                    <video
                      key={i}
                      src={url}
                      controls
                      className="post-media-item"
                      style={{
                        width: "100%",
                        maxHeight: "500px",
                        objectFit: "cover",
                        display: "block",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <img
                      key={i}
                      src={url}
                      className="post-media-item media-zoomable"
                      style={{
                        width: "100%",
                        maxHeight: "500px",
                        objectFit: "cover",
                        display: "block",
                        cursor: "zoom-in",
                      }}
                      alt="Post media"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModalImage(url);
                      }}
                    />
                  ),
                )}
              </div>
            )}

            {showLinkCard &&
              (youtubeId ? (
                <YouTubeEmbed videoId={youtubeId} />
              ) : (
                <LinkCard url={firstUrl} />
              ))}

            {post.originalPost && !isPureRepost && (
              <div
                className="quoted-post"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/post/${post.originalPost!.id}`);
                }}
              >
                <div className="quoted-post-header">
                  <span className="quoted-post-author">
                    {post.originalPost.authorDisplayName}
                  </span>
                  <span className="quoted-post-handle">
                    @{post.originalPost.authorHandle}
                  </span>
                </div>
                <div
                  className="quoted-post-content"
                  dangerouslySetInnerHTML={{
                    __html: linkifyContent(post.originalPost.content),
                  }}
                />
              </div>
            )}

            {showActions && (
              <div
                className="post-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  className="post-action"
                  data-action="reply"
                  onClick={handleReply}
                >
                  <MessageSquare size={18} />
                  <span className="reply-count">
                    {displayPost.replyCount || 0}
                  </span>
                </span>
                <span
                  className={`post-action${isReposted ? " reposted" : ""}`}
                  data-action="repost"
                  onClick={handleRepost}
                >
                  <Repeat2 size={18} />
                  <span className="repost-count">{repostCount || 0}</span>
                </span>
                <span
                  className={`post-action${isLiked ? " liked" : ""}`}
                  data-action="like"
                  onClick={handleLike}
                >
                  <Heart size={18} />
                  <span className="like-count">{likeCount || 0}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {menuOpen && (
        <div className="dropdown-backdrop" onClick={() => setMenuOpen(false)} />
      )}
      <ImageModal
        src={modalImage}
        alt="Post media"
        onClose={() => setModalImage(null)}
      />
    </>
  );
}, arePropsEqual);
