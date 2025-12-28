import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Repeat2,
  Heart,
  BarChart3,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Ban,
} from "lucide-react";
import type { Post } from "../../lib/api";
import { postsApi, socialApi } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { formatTimeAgo, linkifyContent } from "../../utils/format";
import { ImageModal } from "../layout";

interface PostCardProps {
  post: Post;
  showActions?: boolean;
  showMenu?: boolean;
  onDelete?: (postId: string) => void;
}

export function PostCard({
  post,
  showActions = true,
  showMenu = true,
  onDelete,
}: PostCardProps) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isReposted, setIsReposted] = useState(post.isReposted ?? false);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const isPureRepost = !!post.repostOfId && !post.content && post.originalPost;
  const displayPost = isPureRepost ? post.originalPost! : post;

  const isOwnPost =
    currentUser?.handle?.toLowerCase() ===
    displayPost.authorHandle?.toLowerCase();
  const isOwnRepost =
    isPureRepost &&
    currentUser?.handle?.toLowerCase() === post.authorHandle?.toLowerCase();

  const handleCardClick = () => {
    navigate(`/post/${isPureRepost ? displayPost.id : post.id}`);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    if (isReposted) return;

    setIsReposted(true);
    setRepostCount((c) => c + 1);

    try {
      await postsApi.repost(displayPost.id);
    } catch {
      setIsReposted(false);
      setRepostCount((c) => c - 1);
    }
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      /* intentionally empty */
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

  return (
    <>
      {isPureRepost && (
        <div className="repost-indicator">
          <Repeat2 size={14} /> {post.authorDisplayName} reposted
        </div>
      )}
      <div
        className="post-card"
        data-post-id={post.id}
        onClick={handleCardClick}
      >
        <div className="post-header">
          <Link
            to={`/u/${displayPost.authorHandle}`}
            onClick={(e) => e.stopPropagation()}
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
              <div className="avatar" style={{ background: "#1D9BF0" }} />
            )}
          </Link>

          <div className="post-body">
            <div className="post-header-top">
              <div className="post-author-row">
                <Link
                  to={`/u/${displayPost.authorHandle}`}
                  className="post-author"
                  onClick={(e) => e.stopPropagation()}
                >
                  {displayPost.authorDisplayName}
                </Link>
                <Link
                  to={`/u/${displayPost.authorHandle}`}
                  className="post-handle"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{displayPost.authorHandle}
                </Link>
                <span className="post-timestamp">
                  {formatTimeAgo(new Date(displayPost.createdAt))}
                </span>
              </div>

              {showMenu && (
                <div className="post-menu-container">
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
                  <span className="reply-count">{post.replyCount || 0}</span>
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
                <span className="post-action">
                  <BarChart3 size={18} />
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
}
