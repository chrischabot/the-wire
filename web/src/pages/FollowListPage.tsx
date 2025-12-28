import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "../components/layout";
import { UserCard } from "../components/users";
import { usersApi } from "../lib/api";
import type { UserProfile } from "../lib/api";

type ListType = "followers" | "following";

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    position: "sticky" as const,
    top: 0,
    background: "var(--background)",
    zIndex: 10,
  } as React.CSSProperties,
  backButton: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--foreground)",
    transition: "background 0.15s ease",
  } as React.CSSProperties,
  headerText: {
    flex: 1,
  } as React.CSSProperties,
  title: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--foreground)",
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: "13px",
    color: "var(--muted-foreground)",
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
    transition: "color 0.15s ease",
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
  emptyState: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
};

export function FollowListPage() {
  const { handle } = useParams<{ handle: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [isHoveringBack, setIsHoveringBack] = useState(false);

  const listType: ListType = location.pathname.endsWith("/following")
    ? "following"
    : "followers";

  const { data: followersData, isLoading: isFollowersLoading } = useQuery({
    queryKey: ["followers", handle],
    queryFn: () => usersApi.getFollowers(handle!),
    enabled: !!handle && listType === "followers",
  });

  const { data: followingData, isLoading: isFollowingLoading } = useQuery({
    queryKey: ["following", handle],
    queryFn: () => usersApi.getFollowing(handle!),
    enabled: !!handle && listType === "following",
  });

  const userHandles =
    listType === "followers"
      ? (followersData?.data?.followers?.map((f) => f.handle) ?? [])
      : (followingData?.data?.following?.map((f) => f.handle) ?? []);

  const { data: profilesData, isLoading: isProfilesLoading } = useQuery({
    queryKey: [`${listType}-profiles`, handle, userHandles.join(",")],
    queryFn: async () => {
      const profiles: UserProfile[] = [];
      for (const userHandle of userHandles) {
        try {
          const response = await usersApi.getProfile(userHandle);
          if (response.data) {
            profiles.push(response.data);
          }
        } catch {
          /* skip failed profile fetches */
        }
      }
      return profiles;
    },
    enabled: userHandles.length > 0,
  });

  const users = profilesData ?? [];
  const isListLoading =
    listType === "followers" ? isFollowersLoading : isFollowingLoading;
  const isLoading =
    isListLoading || (userHandles.length > 0 && isProfilesLoading);

  const handleBack = () => {
    navigate(`/u/${handle}`);
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

  return (
    <AppLayout showPostButton={true} rightSidebar={rightSidebar}>
      <div style={styles.header}>
        <button
          onClick={handleBack}
          style={{
            ...styles.backButton,
            background: isHoveringBack ? "var(--hover)" : "transparent",
          }}
          onMouseEnter={() => setIsHoveringBack(true)}
          onMouseLeave={() => setIsHoveringBack(false)}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div style={styles.headerText}>
          <h2 style={styles.title}>
            {listType === "followers" ? "Followers" : "Following"}
          </h2>
          <div style={styles.subtitle}>@{handle}</div>
        </div>
      </div>

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(listType === "followers" ? styles.tabActive : {}),
          }}
          onClick={() => navigate(`/u/${handle}/followers`)}
        >
          Followers
          {listType === "followers" && <div style={styles.tabIndicator} />}
        </button>
        <button
          style={{
            ...styles.tab,
            ...(listType === "following" ? styles.tabActive : {}),
          }}
          onClick={() => navigate(`/u/${handle}/following`)}
        >
          Following
          {listType === "following" && <div style={styles.tabIndicator} />}
        </button>
      </div>

      <div>
        {isLoading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={styles.emptyState}>
            {listType === "followers"
              ? "No followers yet"
              : "Not following anyone yet"}
          </div>
        ) : (
          users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              showFollowButton={true}
              showFollowsYouBadge={true}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}
