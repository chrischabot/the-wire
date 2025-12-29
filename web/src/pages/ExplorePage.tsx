import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AppLayout } from "../components/layout";
import { PostCard } from "../components/posts";
import { feedApi } from "../lib/api";

const styles = {
  pageHeader: {
    padding: "16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    position: "sticky" as const,
    top: 0,
    background: "rgba(var(--background-rgb, 254, 254, 254), 0.85)",
    backdropFilter: "blur(12px)",
    zIndex: 10,
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

export function ExplorePage() {
  const navigate = useNavigate();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["feed", "explore"],
    queryFn: async ({ pageParam }) => {
      const response = await feedApi.getExplore(pageParam);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined as string | undefined,
    maxPages: 10,
    staleTime: 1000 * 60 * 3,
  });

  const posts = data?.pages.flatMap((page) => page?.items ?? []) ?? [];
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "300px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

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
              navigate(`/search?q=${encodeURIComponent(value)}`);
            }
          }
        }}
      />
    </div>
  );

  return (
    <AppLayout rightSidebar={rightSidebar} showPostButton={false}>
      <style>{spinnerKeyframes}</style>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Explore</h2>
      </div>

      <div id="explore-feed">
        {isLoading && <div style={styles.emptyState}>Loading posts...</div>}

        {isError && (
          <div style={styles.error}>Error loading posts. Please refresh.</div>
        )}

        {!isLoading && !isError && posts.length === 0 && (
          <div style={styles.emptyState}>No posts yet.</div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        <div ref={loadMoreRef} style={{ height: 20 }} />

        {isFetchingNextPage && (
          <div style={styles.loadingMore}>
            <div style={styles.spinner} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
