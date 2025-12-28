import { useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../components/layout";
import { ComposeBox, PostCard } from "../components/posts";
import type { ComposeBoxRef } from "../components/posts";
import { feedApi } from "../lib/api";
import type { Post } from "../lib/api";

const styles = {
  pageHeader: {
    padding: "16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    position: "sticky" as const,
    top: 0,
    background: "rgba(var(--background-rgb, 254, 254, 254), 0.85)",
    backdropFilter: "blur(12px)",
    zIndex: 100,
  } as React.CSSProperties,
  pageTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--foreground, #2d3748)",
    margin: 0,
  } as React.CSSProperties,
  emptyState: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "var(--muted-foreground, #718096)",
    fontSize: "15px",
  } as React.CSSProperties,
  error: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "#ef4444",
    fontSize: "15px",
  } as React.CSSProperties,
  loadingMore: {
    display: "flex",
    justifyContent: "center",
    padding: "20px",
  } as React.CSSProperties,
  spinner: {
    width: "24px",
    height: "24px",
    border: "2px solid var(--border, #e2e8f0)",
    borderTopColor: "var(--primary, #4299e1)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  } as React.CSSProperties,
  searchBox: {
    padding: "12px",
  } as React.CSSProperties,
  searchInput: {
    width: "100%",
    padding: "12px 16px",
    background: "var(--muted, #f7fafc)",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "9999px",
    fontSize: "15px",
    color: "var(--foreground, #2d3748)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  } as React.CSSProperties,
};

const spinnerKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export function HomePage() {
  const composeRef = useRef<ComposeBoxRef>(null);
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["feed", "home"],
    queryFn: async ({ pageParam }) => {
      const response = await feedApi.getHome(pageParam);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined,
  });

  const posts = data?.pages.flatMap((page) => page?.items ?? []) ?? [];

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

  const handlePostCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["feed", "home"] });
  };

  const handlePostDelete = (postId: string) => {
    queryClient.setQueryData(["feed", "home"], (oldData: typeof data) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          items: page?.items?.filter((p: Post) => p.id !== postId) ?? [],
        })),
      };
    });
  };

  const rightSidebar = (
    <div style={styles.searchBox}>
      <input
        type="text"
        style={styles.searchInput}
        placeholder="Search"
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--primary, #4299e1)";
          e.currentTarget.style.boxShadow =
            "0 0 0 2px rgba(var(--primary-rgb, 66, 153, 225), 0.2)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
          e.currentTarget.style.boxShadow = "none";
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
      <style>{spinnerKeyframes}</style>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Home</h2>
      </div>

      <ComposeBox ref={composeRef} onPostCreated={handlePostCreated} />

      <div id="timeline">
        {isLoading && (
          <div style={styles.emptyState}>Loading your timeline...</div>
        )}

        {isError && (
          <div style={styles.error}>
            Error loading timeline. Please refresh.
          </div>
        )}

        {!isLoading && !isError && posts.length === 0 && (
          <div style={styles.emptyState}>
            No posts in your feed yet. Follow some users!
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handlePostDelete} />
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
