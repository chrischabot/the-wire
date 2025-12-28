import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users, Ban, CheckCircle, Shield } from "lucide-react";
import { AppLayout } from "../components/layout";
import { adminApi } from "../lib/api";
import type { UserProfile } from "../lib/api";

const styles = {
  header: {
    padding: "16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    position: "sticky" as const,
    top: 0,
    background: "rgba(var(--background-rgb, 254, 254, 254), 0.85)",
    backdropFilter: "blur(12px)",
    zIndex: 10,
  } as React.CSSProperties,
  title: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--foreground, #2d3748)",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,
  container: {
    padding: "16px",
  } as React.CSSProperties,
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  } as React.CSSProperties,
  statCard: {
    background: "var(--card, #fefefe)",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "12px",
    padding: "16px",
    textAlign: "center" as const,
  } as React.CSSProperties,
  statValue: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--primary, #4299e1)",
    marginBottom: "4px",
  } as React.CSSProperties,
  statLabel: {
    fontSize: "13px",
    color: "var(--muted-foreground, #718096)",
  } as React.CSSProperties,
  section: {
    marginBottom: "24px",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--foreground, #2d3748)",
    marginBottom: "12px",
  } as React.CSSProperties,
  searchBox: {
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
  } as React.CSSProperties,
  searchInput: {
    flex: 1,
    padding: "10px 14px",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "9999px",
    fontSize: "15px",
    background: "var(--background, #fefefe)",
    color: "var(--foreground, #2d3748)",
    outline: "none",
  } as React.CSSProperties,
  searchButton: {
    padding: "10px 20px",
    background: "var(--primary, #4299e1)",
    color: "var(--primary-foreground, #fff)",
    border: "none",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  } as React.CSSProperties,
  filterTabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  } as React.CSSProperties,
  filterTab: {
    padding: "8px 16px",
    background: "transparent",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "9999px",
    fontSize: "14px",
    color: "var(--foreground, #2d3748)",
    cursor: "pointer",
    transition: "all 0.2s",
  } as React.CSSProperties,
  filterTabActive: {
    background: "var(--primary, #4299e1)",
    borderColor: "var(--primary, #4299e1)",
    color: "var(--primary-foreground, #fff)",
  } as React.CSSProperties,
  userList: {
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,
  userItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    transition: "background 0.2s",
  } as React.CSSProperties,
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    objectFit: "cover" as const,
    background: "var(--muted, #e2e8f0)",
    flexShrink: 0,
  } as React.CSSProperties,
  userInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  userName: {
    fontWeight: 600,
    fontSize: "15px",
    color: "var(--foreground, #2d3748)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  } as React.CSSProperties,
  userHandle: {
    fontSize: "14px",
    color: "var(--muted-foreground, #718096)",
  } as React.CSSProperties,
  badge: {
    fontSize: "11px",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: 500,
  } as React.CSSProperties,
  badgeAdmin: {
    background: "rgba(66, 153, 225, 0.15)",
    color: "#4299e1",
  } as React.CSSProperties,
  badgeBanned: {
    background: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
  } as React.CSSProperties,
  actionButton: {
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    transition: "opacity 0.2s",
  } as React.CSSProperties,
  banButton: {
    background: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
  } as React.CSSProperties,
  unbanButton: {
    background: "rgba(72, 187, 120, 0.1)",
    color: "#48bb78",
  } as React.CSSProperties,
  emptyState: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "var(--muted-foreground, #718096)",
    fontSize: "15px",
  } as React.CSSProperties,
  pagination: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginTop: "16px",
  } as React.CSSProperties,
  pageButton: {
    padding: "8px 16px",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "8px",
    background: "var(--background, #fefefe)",
    color: "var(--foreground, #2d3748)",
    fontSize: "14px",
    cursor: "pointer",
  } as React.CSSProperties,
  error: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "#ef4444",
    fontSize: "15px",
  } as React.CSSProperties,
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "banned" | "admin">("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 60000,
  });

  const stats = statsData?.data;

  const {
    data: usersData,
    isLoading: usersLoading,
    isError,
  } = useQuery({
    queryKey: ["adminUsers", searchQuery, filter, offset],
    queryFn: () => adminApi.getUsers({ q: searchQuery, filter, limit, offset }),
  });

  const users = usersData?.data?.users ?? [];
  const totalUsers = usersData?.data?.total ?? 0;
  const hasMore = usersData?.data?.hasMore ?? false;

  const banMutation = useMutation({
    mutationFn: (handle: string) => adminApi.banUser(handle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (handle: string) => adminApi.unbanUser(handle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
  };

  const handleFilterChange = (newFilter: "all" | "banned" | "admin") => {
    setFilter(newFilter);
    setOffset(0);
  };

  return (
    <AppLayout showPostButton={false}>
      <div style={styles.header}>
        <h1 style={styles.title}>
          <Shield size={24} />
          Admin Dashboard
        </h1>
      </div>

      <div style={styles.container}>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {statsLoading ? "-" : (stats?.users?.total ?? 0)}
            </div>
            <div style={styles.statLabel}>Total Users</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {statsLoading ? "-" : (stats?.posts?.total ?? 0)}
            </div>
            <div style={styles.statLabel}>Total Posts</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {statsLoading ? "-" : (stats?.users?.banned ?? 0)}
            </div>
            <div style={styles.statLabel}>Banned Users</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {statsLoading ? "-" : (stats?.posts?.takenDown ?? 0)}
            </div>
            <div style={styles.statLabel}>Posts Taken Down</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {statsLoading ? "-" : (stats?.users?.last24h ?? 0)}
            </div>
            <div style={styles.statLabel}>New Users (24h)</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>
              {statsLoading ? "-" : (stats?.posts?.last24h ?? 0)}
            </div>
            <div style={styles.statLabel}>New Posts (24h)</div>
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <Users
              size={18}
              style={{ display: "inline", marginRight: "8px" }}
            />
            User Management
          </h2>

          <form style={styles.searchBox} onSubmit={handleSearch}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by handle or name..."
              style={styles.searchInput}
            />
            <button type="submit" style={styles.searchButton}>
              <Search size={16} />
              Search
            </button>
          </form>

          <div style={styles.filterTabs}>
            {(["all", "banned", "admin"] as const).map((f) => (
              <button
                key={f}
                style={{
                  ...styles.filterTab,
                  ...(filter === f ? styles.filterTabActive : {}),
                }}
                onClick={() => handleFilterChange(f)}
              >
                {f === "all"
                  ? "All Users"
                  : f === "banned"
                    ? "Banned"
                    : "Admins"}
              </button>
            ))}
          </div>

          {isError ? (
            <div style={styles.error}>
              Error loading users. You may not have admin privileges.
            </div>
          ) : usersLoading ? (
            <div style={styles.emptyState}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={styles.emptyState}>No users found</div>
          ) : (
            <>
              <div style={styles.userList}>
                {users.map((user: UserProfile) => (
                  <div key={user.id} style={styles.userItem}>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" style={styles.avatar} />
                    ) : (
                      <div
                        style={{
                          ...styles.avatar,
                          background: "var(--primary)",
                        }}
                      />
                    )}
                    <div style={styles.userInfo}>
                      <div style={styles.userName}>
                        {user.displayName || user.handle}
                        {user.isAdmin && (
                          <span
                            style={{ ...styles.badge, ...styles.badgeAdmin }}
                          >
                            Admin
                          </span>
                        )}
                        {user.isBanned && (
                          <span
                            style={{ ...styles.badge, ...styles.badgeBanned }}
                          >
                            Banned
                          </span>
                        )}
                      </div>
                      <div style={styles.userHandle}>@{user.handle}</div>
                    </div>
                    {!user.isAdmin &&
                      (user.isBanned ? (
                        <button
                          style={{
                            ...styles.actionButton,
                            ...styles.unbanButton,
                          }}
                          onClick={() => unbanMutation.mutate(user.handle)}
                          disabled={unbanMutation.isPending}
                        >
                          <CheckCircle
                            size={14}
                            style={{ display: "inline", marginRight: "4px" }}
                          />
                          Unban
                        </button>
                      ) : (
                        <button
                          style={{
                            ...styles.actionButton,
                            ...styles.banButton,
                          }}
                          onClick={() => {
                            if (confirm(`Ban @${user.handle}?`)) {
                              banMutation.mutate(user.handle);
                            }
                          }}
                          disabled={banMutation.isPending}
                        >
                          <Ban
                            size={14}
                            style={{ display: "inline", marginRight: "4px" }}
                          />
                          Ban
                        </button>
                      ))}
                  </div>
                ))}
              </div>

              <div style={styles.pagination}>
                {offset > 0 && (
                  <button
                    style={styles.pageButton}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                  >
                    Previous
                  </button>
                )}
                <span
                  style={{ padding: "8px", color: "var(--muted-foreground)" }}
                >
                  Showing {offset + 1}-{Math.min(offset + limit, totalUsers)} of{" "}
                  {totalUsers}
                </span>
                {hasMore && (
                  <button
                    style={styles.pageButton}
                    onClick={() => setOffset(offset + limit)}
                  >
                    Next
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
