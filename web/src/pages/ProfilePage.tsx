import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { AppLayout, ImageModal } from "../components/layout";
import { PostCard } from "../components/posts";
import { usersApi, socialApi, feedApi } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

const styles = {
  profileHeader: {
    position: "relative" as const,
  } as React.CSSProperties,
  banner: {
    width: "100%",
    height: "200px",
    objectFit: "cover" as const,
    background: "var(--muted)",
    cursor: "zoom-in",
  } as React.CSSProperties,
  bannerPlaceholder: {
    width: "100%",
    height: "200px",
    background: "linear-gradient(135deg, var(--muted) 0%, var(--border) 100%)",
  } as React.CSSProperties,
  profileInfo: {
    padding: "0 16px 16px",
    marginTop: "-48px",
  } as React.CSSProperties,
  actionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "12px",
    height: "36px",
  } as React.CSSProperties,
  avatar: {
    width: "134px",
    height: "134px",
    borderRadius: "50%",
    border: "4px solid var(--background)",
    objectFit: "cover" as const,
    background: "var(--primary)",
    cursor: "zoom-in",
  } as React.CSSProperties,
  avatarPlaceholder: {
    width: "134px",
    height: "134px",
    borderRadius: "50%",
    border: "4px solid var(--background)",
    background: "var(--primary)",
  } as React.CSSProperties,
  name: {
    fontSize: "20px",
    fontWeight: 800,
    color: "var(--foreground)",
    marginTop: "4px",
  } as React.CSSProperties,
  handle: {
    fontSize: "15px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  bio: {
    fontSize: "15px",
    color: "var(--foreground)",
    marginTop: "12px",
    lineHeight: 1.4,
  } as React.CSSProperties,
  meta: {
    display: "flex",
    gap: "16px",
    marginTop: "12px",
    fontSize: "14px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  stats: {
    display: "flex",
    gap: "20px",
    marginTop: "12px",
  } as React.CSSProperties,
  stat: {
    textDecoration: "none",
    color: "var(--muted-foreground)",
    fontSize: "14px",
  } as React.CSSProperties,
  statValue: {
    fontWeight: 700,
    color: "var(--foreground)",
  } as React.CSSProperties,
  tabs: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  tab: {
    flex: 1,
    padding: "16px",
    border: "none",
    background: "transparent",
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--muted-foreground)",
    cursor: "pointer",
    position: "relative" as const,
  } as React.CSSProperties,
  tabActive: {
    color: "var(--foreground)",
    fontWeight: 700,
  } as React.CSSProperties,
  tabIndicator: {
    position: "absolute" as const,
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "56px",
    height: "4px",
    background: "var(--primary)",
    borderRadius: "2px",
  } as React.CSSProperties,
  btnPrimary: {
    padding: "8px 16px",
    background: "var(--foreground)",
    color: "var(--background)",
    border: "none",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,
  btnSecondary: {
    padding: "8px 16px",
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,
  emptyState: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  loadingMore: {
    display: "flex",
    justifyContent: "center",
    padding: "20px",
  } as React.CSSProperties,
  spinner: {
    width: "24px",
    height: "24px",
    border: "2px solid var(--border)",
    borderTopColor: "var(--primary)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  } as React.CSSProperties,
};

export function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "posts" | "replies" | "media" | "likes"
  >("posts");
  const [modalImage, setModalImage] = useState<string | null>(null);

  const isOwnProfile =
    currentUser?.handle?.toLowerCase() === handle?.toLowerCase();

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", handle],
    queryFn: () => usersApi.getProfile(handle!),
    enabled: !!handle,
  });

  const profile = profileData?.data;

  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
  } = useInfiniteQuery({
    queryKey: ["userPosts", handle, activeTab],
    queryFn: async ({ pageParam }) => {
      const response = await feedApi.getUserTimeline(handle!, pageParam);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!handle && activeTab === "posts",
  });

  const posts = postsData?.pages.flatMap((page) => page?.items ?? []) ?? [];

  const followMutation = useMutation({
    mutationFn: () =>
      profile?.isFollowing
        ? socialApi.unfollow(handle!)
        : socialApi.follow(handle!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", handle] });
    },
  });

  const handleScroll = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= docHeight - 300) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (profileLoading) {
    return (
      <AppLayout>
        <div style={styles.emptyState}>Loading profile...</div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div style={styles.emptyState}>User not found</div>
      </AppLayout>
    );
  }

  const joinDate = new Date(profile.joinedAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const rightSidebar = (
    <div style={{ padding: "12px" }}>
      <input
        type="text"
        placeholder="Search"
        style={{
          width: "100%",
          padding: "12px 16px",
          border: "1px solid var(--border)",
          borderRadius: "9999px",
          background: "var(--muted)",
          color: "var(--foreground)",
          fontSize: "15px",
          outline: "none",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = (e.target as HTMLInputElement).value.trim();
            if (value.length >= 2) {
              window.location.href = `/search?q=${encodeURIComponent(value)}`;
            }
          }
        }}
      />
    </div>
  );

  return (
    <AppLayout rightSidebar={rightSidebar}>
      <div className="page-header">
        <h2>@{handle}</h2>
      </div>

      <ImageModal
        src={modalImage}
        alt="Profile image"
        onClose={() => setModalImage(null)}
      />

      <div style={styles.profileHeader}>
        {profile.bannerUrl ? (
          <img
            src={profile.bannerUrl}
            alt="Banner"
            style={styles.banner}
            onClick={() => setModalImage(profile.bannerUrl!)}
          />
        ) : (
          <div style={styles.bannerPlaceholder} />
        )}

        <div style={styles.profileInfo}>
          <div style={styles.actionsRow}>
            {isOwnProfile ? (
              <button
                style={styles.btnSecondary}
                onClick={() => (window.location.href = "/settings")}
              >
                Edit profile
              </button>
            ) : (
              <button
                style={
                  profile.isFollowing ? styles.btnSecondary : styles.btnPrimary
                }
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
              >
                {followMutation.isPending
                  ? "..."
                  : profile.isFollowing
                    ? "Following"
                    : "Follow"}
              </button>
            )}
          </div>

          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              style={styles.avatar}
              onClick={() => setModalImage(profile.avatarUrl!)}
            />
          ) : (
            <div style={styles.avatarPlaceholder} />
          )}

          <div style={styles.name}>{profile.displayName}</div>
          <div style={styles.handle}>@{profile.handle}</div>

          {profile.bio && <div style={styles.bio}>{profile.bio}</div>}

          <div style={styles.meta}>
            {profile.location && <span>📍 {profile.location}</span>}
            <span>📅 Joined {joinDate}</span>
          </div>

          <div style={styles.stats}>
            <Link to={`/u/${handle}/following`} style={styles.stat}>
              <span style={styles.statValue}>{profile.followingCount}</span>{" "}
              Following
            </Link>
            <Link to={`/u/${handle}/followers`} style={styles.stat}>
              <span style={styles.statValue}>{profile.followerCount}</span>{" "}
              Followers
            </Link>
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "posts" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("posts")}
        >
          Posts
          {activeTab === "posts" && <div style={styles.tabIndicator} />}
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "replies" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("replies")}
        >
          Replies
          {activeTab === "replies" && <div style={styles.tabIndicator} />}
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "media" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("media")}
        >
          Media
          {activeTab === "media" && <div style={styles.tabIndicator} />}
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === "likes" ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab("likes")}
        >
          Likes
          {activeTab === "likes" && <div style={styles.tabIndicator} />}
        </button>
      </div>

      <div>
        {activeTab === "posts" && (
          <>
            {postsLoading && (
              <div style={styles.emptyState}>Loading posts...</div>
            )}

            {!postsLoading && posts.length === 0 && (
              <div style={styles.emptyState}>No posts yet</div>
            )}

            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {isFetchingNextPage && (
              <div style={styles.loadingMore}>
                <div style={styles.spinner} />
              </div>
            )}
          </>
        )}

        {activeTab === "replies" && (
          <div style={styles.emptyState}>Replies coming soon</div>
        )}

        {activeTab === "media" && (
          <div style={styles.emptyState}>Media coming soon</div>
        )}

        {activeTab === "likes" && (
          <div style={styles.emptyState}>Likes coming soon</div>
        )}
      </div>
    </AppLayout>
  );
}
