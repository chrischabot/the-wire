import { useEffect, useCallback } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Heart,
  Repeat2,
  UserPlus,
  MessageSquare,
  AtSign,
  Quote,
} from "lucide-react";
import { AppLayout } from "../components/layout";
import { notificationsApi } from "../lib/api";
import type { Notification } from "../lib/api";
import { formatTimeAgo } from "../utils/format";

const styles = {
  notificationItem: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    borderBottom: "1px solid var(--border)",
    textDecoration: "none",
    color: "inherit",
    transition: "background 0.15s ease",
  } as React.CSSProperties,
  notificationItemUnread: {
    background: "rgba(var(--primary-rgb), 0.05)",
  } as React.CSSProperties,
  iconContainer: {
    width: "40px",
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "4px",
  } as React.CSSProperties,
  content: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap" as const,
    marginBottom: "4px",
  } as React.CSSProperties,
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    objectFit: "cover" as const,
  } as React.CSSProperties,
  avatarPlaceholder: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "var(--primary)",
  } as React.CSSProperties,
  actor: {
    fontWeight: 700,
    fontSize: "15px",
    color: "var(--foreground)",
  } as React.CSSProperties,
  text: {
    fontSize: "15px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  time: {
    fontSize: "14px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  preview: {
    fontSize: "14px",
    color: "var(--muted-foreground)",
    marginTop: "4px",
    lineHeight: 1.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as const,
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

const iconColors: Record<Notification["type"], string> = {
  like: "var(--like)",
  repost: "var(--repost)",
  follow: "var(--primary)",
  reply: "var(--primary)",
  mention: "var(--primary)",
  quote: "var(--primary)",
};

function NotificationIcon({ type }: { type: Notification["type"] }) {
  const color = iconColors[type];
  const iconProps = { size: 18, color, fill: type === "like" ? color : "none" };

  switch (type) {
    case "like":
      return <Heart {...iconProps} />;
    case "repost":
      return <Repeat2 {...iconProps} />;
    case "follow":
      return <UserPlus {...iconProps} />;
    case "reply":
      return <MessageSquare {...iconProps} />;
    case "mention":
      return <AtSign {...iconProps} />;
    case "quote":
      return <Quote {...iconProps} />;
    default:
      return null;
  }
}

function notificationText(notification: Notification): string {
  switch (notification.type) {
    case "like":
      return "liked your post";
    case "repost":
      return "reposted your post";
    case "follow":
      return "followed you";
    case "reply":
      return "replied to your post";
    case "mention":
      return "mentioned you";
    case "quote":
      return "quoted your post";
    default:
      return "";
  }
}

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: async ({ pageParam }) => {
      const response = await notificationsApi.getAll(pageParam);
      return response.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage?.hasMore ? lastPage?.cursor : undefined,
    initialPageParam: undefined as string | undefined,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unreadCount"] });
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      markAllReadMutation.mutate();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const notifications =
    data?.pages.flatMap((page) => page?.notifications ?? []) ?? [];

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
      />
    </div>
  );

  return (
    <AppLayout showPostButton={false} rightSidebar={rightSidebar}>
      <div className="page-header">
        <h2>Notifications</h2>
      </div>

      <div>
        {isLoading && (
          <div style={styles.emptyState}>Loading notifications...</div>
        )}

        {isError && (
          <div style={{ ...styles.emptyState, color: "var(--destructive)" }}>
            Error loading notifications. Please refresh.
          </div>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <div style={styles.emptyState}>No notifications yet.</div>
        )}

        {notifications.map((notification) => (
          <Link
            key={notification.id}
            to={
              notification.postId
                ? `/post/${notification.postId}`
                : `/u/${notification.actorHandle}`
            }
            style={{
              ...styles.notificationItem,
              ...(notification.read ? {} : styles.notificationItemUnread),
            }}
          >
            <div style={styles.iconContainer}>
              <NotificationIcon type={notification.type} />
            </div>
            <div style={styles.content}>
              <div style={styles.header}>
                {notification.actorAvatarUrl ? (
                  <img
                    src={notification.actorAvatarUrl}
                    style={styles.avatar}
                    alt=""
                  />
                ) : (
                  <div style={styles.avatarPlaceholder} />
                )}
                <span style={styles.actor}>
                  {notification.actorDisplayName}
                </span>
                <span style={styles.text}>
                  {notificationText(notification)}
                </span>
                <span style={styles.time}>
                  · {formatTimeAgo(new Date(notification.createdAt))}
                </span>
              </div>
              {notification.postContent && (
                <div style={styles.preview}>{notification.postContent}</div>
              )}
            </div>
          </Link>
        ))}

        {isFetchingNextPage && (
          <div style={styles.loadingMore}>
            <div style={styles.spinner} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
