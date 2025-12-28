import { useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "../components/layout";
import { PostCard, ComposeBox } from "../components/posts";
import type { ComposeBoxRef } from "../components/posts";
import { postsApi } from "../lib/api";

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
};

export function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const shouldFocusReply = searchParams.get("reply") === "true";
  const composeRef = useRef<ComposeBoxRef>(null);
  const queryClient = useQueryClient();

  const {
    data: postData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["post", id],
    queryFn: () => postsApi.get(id!),
    enabled: !!id,
  });

  const { data: repliesData } = useQuery({
    queryKey: ["replies", id],
    queryFn: () => postsApi.getReplies(id!),
    enabled: !!id,
  });

  const post = postData?.data;
  const replies = repliesData?.data?.replies ?? [];

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

        <ComposeBox
          ref={composeRef}
          placeholder={`Reply to @${post.authorHandle}...`}
          replyToId={post.id}
          onPostCreated={handleReplyCreated}
          variant="reply"
        />
      </div>

      <div style={styles.repliesHeader}>
        <h3 style={styles.repliesTitle}>Replies</h3>
      </div>

      <div>
        {replies.length === 0 ? (
          <div style={styles.emptyState}>No replies yet. Be the first!</div>
        ) : (
          replies.map((reply) => <PostCard key={reply.id} post={reply} />)
        )}
      </div>
    </AppLayout>
  );
}
