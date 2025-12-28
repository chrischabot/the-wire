import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/authStore";
import { wsManager } from "./websocket";

interface NotificationMessage {
  type: "notification";
  notificationType: string;
  postId?: string;
  fromUserId?: string;
}

interface NewPostMessage {
  type: "new_post";
  postId: string;
  authorId: string;
}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      if (isConnectedRef.current) {
        wsManager.disconnect();
        isConnectedRef.current = false;
      }
      return;
    }

    if (isConnectedRef.current) return;

    const handleNotification = (data: unknown) => {
      const message = data as NotificationMessage;
      if (message.type === "notification") {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
    };

    const handleNewPost = (data: unknown) => {
      const message = data as NewPostMessage;
      if (message.type === "new_post") {
        queryClient.invalidateQueries({ queryKey: ["feed", "home"] });
      }
    };

    wsManager.on("notification", handleNotification);
    wsManager.on("new_post", handleNewPost);
    wsManager.connect();
    isConnectedRef.current = true;

    return () => {
      wsManager.off("notification", handleNotification);
      wsManager.off("new_post", handleNewPost);
    };
  }, [token, queryClient]);
}
