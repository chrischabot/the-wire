import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { AppLayout } from "../components/layout";
import { usersApi, authApi, mediaApi } from "../lib/api";
import { useThemeStore, THEMES } from "../stores/themeStore";
import { useAuthStore } from "../stores/authStore";

const styles = {
  container: {
    padding: "20px",
  } as React.CSSProperties,
  section: {
    marginBottom: "32px",
    paddingBottom: "24px",
    borderBottom: "1px solid var(--border)",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 700,
    marginBottom: "16px",
    color: "var(--foreground)",
  } as React.CSSProperties,
  themeLabel: {
    fontSize: "14px",
    color: "var(--muted-foreground)",
    marginBottom: "12px",
    display: "block",
  } as React.CSSProperties,
  themeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
  } as React.CSSProperties,
  themeOption: {
    padding: "16px 12px",
    border: "2px solid var(--border)",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "center" as const,
    transition: "all 0.2s ease",
    background: "var(--card)",
  } as React.CSSProperties,
  themeOptionActive: {
    borderColor: "var(--primary)",
    background: "rgba(var(--primary-rgb), 0.1)",
  } as React.CSSProperties,
  themeOptionName: {
    fontWeight: 600,
    fontSize: "14px",
    marginBottom: "4px",
    color: "var(--foreground)",
  } as React.CSSProperties,
  themeOptionDesc: {
    fontSize: "12px",
    color: "var(--muted-foreground)",
  } as React.CSSProperties,
  bannerContainer: {
    position: "relative" as const,
    width: "100%",
    height: "150px",
    borderRadius: "16px",
    overflow: "hidden",
    background: "var(--muted)",
    marginBottom: "0",
  } as React.CSSProperties,
  bannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  } as React.CSSProperties,
  bannerPlaceholder: {
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, var(--muted) 0%, var(--border) 100%)",
  } as React.CSSProperties,
  mediaEditBtn: {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.6)",
    border: "none",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  avatarWrapper: {
    position: "relative" as const,
    marginTop: "-50px",
    marginLeft: "16px",
    marginBottom: "16px",
    width: "100px",
    height: "100px",
  } as React.CSSProperties,
  avatarContainer: {
    position: "relative" as const,
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    overflow: "hidden",
    border: "4px solid var(--background)",
    background: "var(--muted)",
  } as React.CSSProperties,
  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  } as React.CSSProperties,
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    background: "var(--primary)",
  } as React.CSSProperties,
  avatarEditBtn: {
    position: "absolute" as const,
    bottom: "0",
    right: "0",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.6)",
    border: "2px solid var(--background)",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,
  formGroup: {
    marginBottom: "16px",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: "14px",
    color: "var(--primary)",
    marginBottom: "8px",
    fontWeight: 500,
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "16px",
    background: "var(--background)",
    color: "var(--foreground)",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    padding: "12px",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "16px",
    background: "var(--background)",
    color: "var(--foreground)",
    resize: "vertical" as const,
    minHeight: "80px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  btnPrimary: {
    padding: "10px 20px",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    border: "none",
    borderRadius: "9999px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,
  btnSecondary: {
    padding: "10px 20px",
    background: "transparent",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "9999px",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
  } as React.CSSProperties,
  link: {
    color: "var(--primary)",
    textDecoration: "underline",
    fontSize: "14px",
  } as React.CSSProperties,
  linkDesc: {
    fontSize: "13px",
    color: "var(--muted-foreground)",
    marginTop: "4px",
  } as React.CSSProperties,
  uploadStatus: {
    fontSize: "13px",
    marginTop: "8px",
    padding: "8px",
    borderRadius: "8px",
  } as React.CSSProperties,
  message: {
    marginTop: "12px",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "14px",
  } as React.CSSProperties,
};

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentTheme = useThemeStore((s) => s.current);
  const setTheme = useThemeStore((s) => s.setTheme);
  const logout = useAuthStore((s) => s.logout);

  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ["currentProfile"],
    queryFn: async () => {
      const meResponse = await authApi.me();
      if (meResponse.data?.handle) {
        return usersApi.getProfile(meResponse.data.handle);
      }
      return null;
    },
  });

  const profile = profileData?.data;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadStatusType, setUploadStatusType] = useState<
    "" | "uploading" | "success" | "error"
  >("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      usersApi.updateProfile({ displayName, bio, location, website }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentProfile"] });
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    },
    onError: () => {
      setMessage("Failed to update profile");
    },
  });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileMutation.mutateAsync();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAvatarUploading(true);
      setUploadStatus("Uploading avatar...");
      setUploadStatusType("uploading");

      await mediaApi.uploadAvatar(file);

      setUploadStatus("Avatar updated!");
      setUploadStatusType("success");
      await refetchProfile();

      setTimeout(() => {
        setUploadStatus("");
        setUploadStatusType("");
      }, 2000);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
      setUploadStatusType("error");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBannerUploading(true);
      setUploadStatus("Uploading banner...");
      setUploadStatusType("uploading");

      await mediaApi.uploadBanner(file);

      setUploadStatus("Banner updated!");
      setUploadStatusType("success");
      await refetchProfile();

      setTimeout(() => {
        setUploadStatus("");
        setUploadStatusType("");
      }, 2000);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
      setUploadStatusType("error");
    } finally {
      setBannerUploading(false);
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* intentionally empty */
    }
    logout();
    navigate("/login");
  };

  const rightSidebar = (
    <div className="search-box">
      <input
        type="text"
        className="search-input"
        placeholder="Search"
        style={styles.input}
      />
    </div>
  );

  return (
    <AppLayout showPostButton={false} rightSidebar={rightSidebar}>
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div style={styles.container}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Appearance</h3>
          <span style={styles.themeLabel}>Choose your theme</span>
          <div style={styles.themeGrid}>
            {THEMES.map((theme) => (
              <div
                key={theme.name}
                style={{
                  ...styles.themeOption,
                  ...(currentTheme === theme.name
                    ? styles.themeOptionActive
                    : {}),
                }}
                onClick={() => setTheme(theme.name)}
              >
                <div style={styles.themeOptionName}>{theme.display}</div>
                <div style={styles.themeOptionDesc}>{theme.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Profile</h3>

          <div style={styles.bannerContainer}>
            {profile?.bannerUrl ? (
              <img
                src={profile.bannerUrl}
                alt="Banner"
                style={styles.bannerImage}
              />
            ) : (
              <div style={styles.bannerPlaceholder} />
            )}
            <button
              type="button"
              style={{
                ...styles.mediaEditBtn,
                opacity: bannerUploading ? 0.5 : 1,
              }}
              onClick={() => bannerInputRef.current?.click()}
              disabled={bannerUploading}
            >
              <Camera size={20} />
            </button>
            <input
              type="file"
              ref={bannerInputRef}
              accept="image/*"
              hidden
              onChange={handleBannerUpload}
            />
          </div>

          <div style={styles.avatarWrapper}>
            <div style={styles.avatarContainer}>
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  style={styles.avatarImage}
                />
              ) : (
                <div style={styles.avatarPlaceholder} />
              )}
            </div>
            <button
              type="button"
              style={{
                ...styles.avatarEditBtn,
                opacity: avatarUploading ? 0.5 : 1,
              }}
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
            >
              <Camera size={16} />
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              accept="image/*"
              hidden
              onChange={handleAvatarUpload}
            />
          </div>

          {uploadStatus && (
            <div
              style={{
                ...styles.uploadStatus,
                background:
                  uploadStatusType === "success"
                    ? "rgba(72, 187, 120, 0.1)"
                    : uploadStatusType === "error"
                      ? "rgba(245, 101, 101, 0.1)"
                      : "rgba(66, 153, 225, 0.1)",
                color:
                  uploadStatusType === "success"
                    ? "#48bb78"
                    : uploadStatusType === "error"
                      ? "#f56565"
                      : "var(--primary)",
              }}
            >
              {uploadStatus}
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                rows={3}
                style={styles.textarea}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={50}
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={styles.input}
              />
            </div>

            <button
              type="submit"
              style={{
                ...styles.btnPrimary,
                opacity: updateProfileMutation.isPending ? 0.7 : 1,
              }}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </button>
          </form>

          {message && (
            <div
              style={{
                ...styles.message,
                background: message.includes("Failed")
                  ? "rgba(245, 101, 101, 0.1)"
                  : "rgba(72, 187, 120, 0.1)",
                color: message.includes("Failed") ? "#f56565" : "#48bb78",
              }}
            >
              {message}
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Content</h3>
          <a href="/settings/muted" style={styles.link}>
            Muted words Manage filters
          </a>
          <div style={styles.linkDesc}>
            Hide posts containing specific words or phrases.
          </div>
        </div>

        <div style={{ ...styles.section, borderBottom: "none" }}>
          <h3 style={styles.sectionTitle}>Account</h3>
          <button style={styles.btnSecondary} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
