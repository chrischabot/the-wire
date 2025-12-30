import { useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AppLayout } from "../components/layout";
import { PostCard, ComposeBox } from "../components/posts";
import type { ComposeBoxRef } from "../components/posts";
import { postsApi } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

const styles = {
  postDetail: {
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  repliesHeader: {
    padding: "16px",
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  repliesTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--foreground)",
    margin: 0,
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
    border: "2px solid var(--border, #e2e8f0)",
    borderTopColor: "var(--primary, #4299e1)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  } as React.CSSProperties,
};

const spinnerKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const shouldFocusReply = searchParams.get("reply") === "true";
  const composeRef = useRef<ComposeBoxRef>(null);
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const {
    data: postData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["post", id],
    queryFn: () => postsApi.get(id!),
    enabled: !!id,
  });

  const {
    data: repliesData,
    isLoading: isLoadingReplies,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["replies", id],
    queryFn: async ({ pageParam }) => {
      const response = await postsApi.getReplies(id!, pageParam);
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage?.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!id,
  });

  const post = postData?.data;
  const replies =
    repliesData?.pages.flatMap((page) => page?.replies ?? []) ?? [];

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (shouldFocusReply && post && composeRef.current) {
      setTimeout(() => composeRef.current?.focus(), 100);
    }
  }, [shouldFocusReply, post]);

  const handleReplyCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["replies", id] });
    queryClient.invalidateQueries({ queryKey: ["post", id] });
  };

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

  if (isLoading) {
    return (
      <AppLayout showPostButton={false} rightSidebar={rightSidebar}>
        <div className="page-header">
          <h2>Post</h2>
        </div>
        <div style={styles.emptyState}>Loading post...</div>
      </AppLayout>
    );
  }

  if (isError || !post) {
    return (
      <AppLayout showPostButton={false} rightSidebar={rightSidebar}>
        <div className="page-header">
          <h2>Post</h2>
        </div>
        <div style={styles.emptyState}>Post not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showPostButton={false} rightSidebar={rightSidebar}>
      <div className="page-header">
        <h2>Post</h2>
      </div>

      <div style={styles.postDetail}>
        <PostCard post={post} showMenu={true} showActions={true} />

        {isAuthenticated ? (
          <ComposeBox
            ref={composeRef}
            placeholder={`Reply to @${post.authorHandle}...`}
            replyToId={post.id}
            onPostCreated={handleReplyCreated}
            variant="reply"
          />
        ) : (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              borderTop: "1px solid var(--border)",
              color: "var(--muted-foreground)",
            }}
          >
            <Link
              to="/auth"
              style={{ color: "var(--primary)", textDecoration: "none" }}
            >
              Sign in
            </Link>{" "}
            to reply to this post
          </div>
        )}
      </div>

      <div style={styles.repliesHeader}>
        <h3 style={styles.repliesTitle}>Replies</h3>
      </div>

      <style>{spinnerKeyframes}</style>
      <div style={{ overflowAnchor: "none" }}>
        {isLoadingReplies ? (
          <div style={styles.emptyState}>Loading replies...</div>
        ) : replies.length === 0 ? (
          <div style={styles.emptyState}>
            No replies yet.{" "}
            {isAuthenticated ? (
              "Be the first!"
            ) : (
              <Link
                to="/auth"
                style={{ color: "var(--primary)", textDecoration: "none" }}
              >
                Sign in to reply
              </Link>
            )}
          </div>
        ) : (
          replies.map((reply) => <PostCard key={reply.id} post={reply} />)
        )}

        {isFetchingNextPage && (
          <div style={styles.loadingMore}>
            <div style={styles.spinner} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
