import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { AppLayout } from "../components/layout";
import { PostCard } from "../components/posts";
import { UserCard } from "../components/users";
import { searchApi } from "../lib/api";

const styles = {
  searchForm: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  searchInputWrapper: {
    flex: 1,
    position: "relative" as const,
  } as React.CSSProperties,
  searchIcon: {
    position: "absolute" as const,
    left: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  searchInput: {
    width: "100%",
    padding: "12px 16px 12px 48px",
    border: "1px solid var(--border)",
    borderRadius: "9999px",
    fontSize: "15px",
    background: "var(--muted)",
    color: "var(--foreground)",
    outline: "none",
  } as React.CSSProperties,
  searchButton: {
    padding: "12px 24px",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    border: "none",
    borderRadius: "9999px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
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
  section: {
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 700,
    padding: "16px",
    color: "var(--foreground)",
  } as React.CSSProperties,
  emptyState: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<"top" | "people" | "posts">("top");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["search", initialQuery, activeTab],
    queryFn: () => searchApi.search(initialQuery, activeTab),
    enabled: initialQuery.length >= 2,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      setSearchParams({ q: query.trim() });
    }
  };

  const people = data?.data?.people ?? [];
  const posts = data?.data?.posts ?? [];

  return (
    <AppLayout showPostButton={false}>
      <div className="page-header">
        <h2>Search</h2>
      </div>

      <form onSubmit={handleSearch} style={styles.searchForm}>
        <div style={styles.searchInputWrapper}>
          <Search size={20} style={styles.searchIcon} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users or posts..."
            autoFocus
            style={styles.searchInput}
          />
        </div>
        <button type="submit" style={styles.searchButton}>
          Search
        </button>
      </form>

      {initialQuery && (
        <>
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === "top" ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab("top")}
            >
              Top
              {activeTab === "top" && <div style={styles.tabIndicator} />}
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === "people" ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab("people")}
            >
              People
              {activeTab === "people" && <div style={styles.tabIndicator} />}
            </button>
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
          </div>

          <div>
            {isLoading && <div style={styles.emptyState}>Searching...</div>}

            {isError && (
              <div
                style={{ ...styles.emptyState, color: "var(--destructive)" }}
              >
                Search failed. Please try again.
              </div>
            )}

            {!isLoading && !isError && (
              <>
                {(activeTab === "top" || activeTab === "people") &&
                  people.length > 0 && (
                    <div style={styles.section}>
                      {activeTab === "top" && (
                        <h3 style={styles.sectionTitle}>People</h3>
                      )}
                      {people.map((user) => (
                        <UserCard key={user.id} user={user} />
                      ))}
                    </div>
                  )}

                {(activeTab === "top" || activeTab === "posts") &&
                  posts.length > 0 && (
                    <div style={styles.section}>
                      {activeTab === "top" && (
                        <h3 style={styles.sectionTitle}>Posts</h3>
                      )}
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </div>
                  )}

                {people.length === 0 && posts.length === 0 && (
                  <div style={styles.emptyState}>
                    No results found for "{initialQuery}"
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {!initialQuery && (
        <div style={styles.emptyState}>
          Enter a search term to find users and posts
        </div>
      )}
    </AppLayout>
  );
}
