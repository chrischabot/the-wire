import { useAuthStore } from "../stores/authStore";

const API_BASE = "/api";

export interface User {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string;
  bannerUrl: string;
  joinedAt: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isVerified: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  isFollowing?: boolean;
  followsYou?: boolean;
  isBlocked?: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  content: string;
  mediaUrls: string[];
  replyToId?: string;
  quoteOfId?: string;
  repostOfId?: string;
  createdAt: number;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
  isLiked?: boolean;
  isReposted?: boolean;
  originalPost?: Post;
}

export interface Notification {
  id: string;
  type: "like" | "repost" | "follow" | "reply" | "mention" | "quote";
  actorId: string;
  actorHandle: string;
  actorDisplayName: string;
  actorAvatarUrl: string;
  postId?: string;
  postContent?: string;
  createdAt: number;
  read: boolean;
}

export interface MutedWordEntry {
  word: string;
  scope?: "all" | "not_following";
  expiresAt?: number | null;
}

export interface UserSettings {
  emailNotifications: boolean;
  privateAccount: boolean;
  mutedWords: MutedWordEntry[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    items: T[];
    nextCursor?: string;
  };
  error?: string;
}

export interface NotificationsResponse {
  success: boolean;
  data?: {
    notifications: Notification[];
    cursor: string | null;
    hasMore: boolean;
    unreadCount: number;
  };
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const { token } = useAuthStore.getState();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export const authApi = {
  async signup(
    email: string,
    password: string,
    handle: string,
  ): Promise<ApiResponse<{ token: string; user: User; expiresAt: number }>> {
    const response = await apiRequest<{
      token: string;
      user: User;
      expiresAt: number;
    }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, handle }),
    });

    if (response.success && response.data) {
      useAuthStore.getState().setAuth(response.data.token, response.data.user);
    }

    return response;
  },

  async login(
    email: string,
    password: string,
  ): Promise<ApiResponse<{ token: string; user: User; expiresAt: number }>> {
    const response = await apiRequest<{
      token: string;
      user: User;
      expiresAt: number;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      useAuthStore.getState().setAuth(response.data.token, response.data.user);
    }

    return response;
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await apiRequest<void>("/auth/logout", { method: "POST" });
    useAuthStore.getState().logout();
    return response;
  },

  async me(): Promise<ApiResponse<User>> {
    return await apiRequest<User>("/auth/me");
  },
};

export const usersApi = {
  async getProfile(handle: string): Promise<ApiResponse<UserProfile>> {
    return await apiRequest<UserProfile>(`/users/${handle}`);
  },

  async updateProfile(
    updates: Partial<
      Pick<UserProfile, "displayName" | "bio" | "location" | "website">
    >,
  ): Promise<ApiResponse<UserProfile>> {
    return await apiRequest<UserProfile>("/users/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async getSettings(): Promise<ApiResponse<UserSettings>> {
    return await apiRequest<UserSettings>("/users/me/settings");
  },

  async updateSettings(
    updates: Partial<UserSettings>,
  ): Promise<ApiResponse<UserSettings>> {
    return await apiRequest<UserSettings>("/users/me/settings", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async getFollowers(
    handle: string,
  ): Promise<
    ApiResponse<{ followers: { id: string; handle: string }[]; count: number }>
  > {
    return await apiRequest<{
      followers: { id: string; handle: string }[];
      count: number;
    }>(`/users/${handle}/followers`);
  },

  async getFollowing(
    handle: string,
  ): Promise<
    ApiResponse<{ following: { id: string; handle: string }[]; count: number }>
  > {
    return await apiRequest<{
      following: { id: string; handle: string }[];
      count: number;
    }>(`/users/${handle}/following`);
  },
};

export const socialApi = {
  async follow(handle: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/users/${handle}/follow`, {
      method: "POST",
    });
  },

  async unfollow(handle: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/users/${handle}/follow`, {
      method: "DELETE",
    });
  },

  async block(handle: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/users/${handle}/block`, {
      method: "POST",
    });
  },

  async unblock(handle: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/users/${handle}/block`, {
      method: "DELETE",
    });
  },
};

export const postsApi = {
  async create(
    content: string,
    options: {
      mediaUrls?: string[];
      replyToId?: string;
      quoteOfId?: string;
    } = {},
  ): Promise<ApiResponse<Post>> {
    return await apiRequest<Post>("/posts", {
      method: "POST",
      body: JSON.stringify({ content, ...options }),
    });
  },

  async get(postId: string): Promise<ApiResponse<Post>> {
    return await apiRequest<Post>(`/posts/${postId}`);
  },

  async delete(postId: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/posts/${postId}`, {
      method: "DELETE",
    });
  },

  async like(postId: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/posts/${postId}/like`, {
      method: "POST",
    });
  },

  async unlike(postId: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/posts/${postId}/like`, {
      method: "DELETE",
    });
  },

  async repost(postId: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/posts/${postId}/repost`, {
      method: "POST",
    });
  },

  async getReplies(
    postId: string,
  ): Promise<
    ApiResponse<{ replies: Post[]; cursor: string | null; hasMore: boolean }>
  > {
    return await apiRequest<{
      replies: Post[];
      cursor: string | null;
      hasMore: boolean;
    }>(`/posts/${postId}/replies`);
  },
};

export const feedApi = {
  async getHome(cursor?: string, limit = 20): Promise<PaginatedResponse<Post>> {
    let url = `/feed/home?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return (await apiRequest(url)) as PaginatedResponse<Post>;
  },

  async getExplore(
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<Post>> {
    let url = `/feed/global?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return (await apiRequest(url)) as PaginatedResponse<Post>;
  },

  async getUserTimeline(
    handle: string,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<Post>> {
    let url = `/users/${handle}/posts?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return (await apiRequest(url)) as PaginatedResponse<Post>;
  },
};

export const notificationsApi = {
  async getAll(cursor?: string, limit = 20): Promise<NotificationsResponse> {
    let url = `/notifications?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    return (await apiRequest(url)) as NotificationsResponse;
  },

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return await apiRequest<{ count: number }>("/notifications/unread-count");
  },

  async markAsRead(notificationId: string): Promise<ApiResponse<void>> {
    return await apiRequest<void>(`/notifications/${notificationId}/read`, {
      method: "PUT",
    });
  },

  async markAllAsRead(): Promise<ApiResponse<void>> {
    return await apiRequest<void>("/notifications/read-all", {
      method: "PUT",
    });
  },
};

export const searchApi = {
  async search(
    query: string,
    type: "all" | "users" | "posts" = "all",
  ): Promise<ApiResponse<{ users?: UserProfile[]; posts?: Post[] }>> {
    return await apiRequest<{ users?: UserProfile[]; posts?: Post[] }>(
      `/search?q=${encodeURIComponent(query)}&type=${type}`,
    );
  },
};

export const mediaApi = {
  async upload(file: File): Promise<ApiResponse<{ url: string }>> {
    const { token } = useAuthStore.getState();

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/media/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    return data;
  },

  async uploadAvatar(file: File): Promise<ApiResponse<{ url: string }>> {
    const { token } = useAuthStore.getState();

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/media/users/me/avatar`, {
      method: "PUT",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    return data;
  },

  async uploadBanner(file: File): Promise<ApiResponse<{ url: string }>> {
    const { token } = useAuthStore.getState();

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/media/users/me/banner`, {
      method: "PUT",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    return data;
  },
};
