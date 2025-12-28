import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Image, Video, X } from "lucide-react";
import { postsApi, mediaApi } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

const MAX_LENGTH = 280;

const styles = {
  container: {
    padding: "16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
  } as React.CSSProperties,
  replyContainer: {
    padding: "12px 16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    background: "var(--muted, #f7fafc)",
  } as React.CSSProperties,
  inner: {
    display: "flex",
    gap: "12px",
  } as React.CSSProperties,
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    objectFit: "cover" as const,
    flexShrink: 0,
    background: "var(--muted, #e2e8f0)",
  } as React.CSSProperties,
  avatarPlaceholder: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    flexShrink: 0,
    background: "var(--primary, #4299e1)",
  } as React.CSSProperties,
  contentArea: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  textarea: {
    width: "100%",
    minHeight: "80px",
    padding: "12px 0",
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "none" as const,
    fontSize: "18px",
    lineHeight: "1.4",
    color: "var(--foreground, #2d3748)",
    fontFamily: "inherit",
  } as React.CSSProperties,
  mediaPreview: {
    marginTop: "12px",
  } as React.CSSProperties,
  mediaPreviewContent: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px",
  } as React.CSSProperties,
  mediaItem: {
    position: "relative" as const,
    display: "inline-block",
  } as React.CSSProperties,
  mediaImage: {
    maxWidth: "100%",
    maxHeight: "200px",
    borderRadius: "12px",
    objectFit: "cover" as const,
  } as React.CSSProperties,
  removeButton: {
    position: "absolute" as const,
    top: "8px",
    right: "8px",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "rgba(0, 0, 0, 0.75)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s",
  } as React.CSSProperties,
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border, #e2e8f0)",
  } as React.CSSProperties,
  actions: {
    display: "flex",
    gap: "4px",
  } as React.CSSProperties,
  iconButton: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--primary, #4299e1)",
    transition: "background 0.2s",
  } as React.CSSProperties,
  iconButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as React.CSSProperties,
  charCounter: {
    fontSize: "14px",
    color: "var(--muted-foreground, #718096)",
  } as React.CSSProperties,
  charCounterOverLimit: {
    fontSize: "14px",
    color: "#ef4444",
    fontWeight: 600,
  } as React.CSSProperties,
  postButton: {
    padding: "8px 16px",
    borderRadius: "9999px",
    background: "var(--primary, #4299e1)",
    color: "var(--primary-foreground, #fff)",
    border: "none",
    fontWeight: 600,
    fontSize: "15px",
    cursor: "pointer",
    transition: "opacity 0.2s, background 0.2s",
  } as React.CSSProperties,
  postButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,
};

interface ComposeBoxProps {
  placeholder?: string;
  replyToId?: string;
  quoteOfId?: string;
  onPostCreated?: () => void;
  variant?: "default" | "reply";
}

export interface ComposeBoxRef {
  focus: () => void;
}

export const ComposeBox = forwardRef<ComposeBoxRef, ComposeBoxProps>(
  function ComposeBox(
    {
      placeholder = "What's happening?",
      replyToId,
      quoteOfId,
      onPostCreated,
      variant = "default",
    },
    ref,
  ) {
    const user = useAuthStore((s) => s.user);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [content, setContent] = useState("");
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    const charCount = content.length;
    const isOverLimit = charCount > MAX_LENGTH;
    const canSubmit =
      !isSubmitting &&
      !isUploading &&
      !isOverLimit &&
      (content.trim().length > 0 || mediaUrls.length > 0);

    const handleSubmit = async () => {
      if (!canSubmit) return;

      setIsSubmitting(true);
      try {
        await postsApi.create(content, {
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          replyToId,
          quoteOfId,
        });
        setContent("");
        setMediaUrls([]);
        onPostCreated?.();
      } catch {
        alert("Failed to create post");
      } finally {
        setIsSubmitting(false);
      }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          const response = await mediaApi.upload(file);
          if (response.data?.url) {
            setMediaUrls((prev) => [...prev, response.data!.url]);
          }
        }
      } catch {
        alert("Failed to upload media");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };

    const removeMedia = (index: number) => {
      setMediaUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
        handleSubmit();
      }
    };

    const containerStyle =
      variant === "reply" ? styles.replyContainer : styles.container;

    return (
      <div style={containerStyle}>
        <div style={styles.inner}>
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} style={styles.avatar} alt="" />
          ) : (
            <div style={styles.avatarPlaceholder} />
          )}

          <div style={styles.contentArea}>
            <textarea
              ref={textareaRef}
              id="note-content"
              placeholder={placeholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              style={styles.textarea}
            />

            {mediaUrls.length > 0 && (
              <div style={styles.mediaPreview}>
                <div style={styles.mediaPreviewContent}>
                  {mediaUrls.map((url, i) => (
                    <div key={i} style={styles.mediaItem}>
                      <img
                        src={url}
                        alt="Upload preview"
                        style={styles.mediaImage}
                      />
                      <button
                        onClick={() => removeMedia(i)}
                        type="button"
                        style={styles.removeButton}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(0, 0, 0, 0.9)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(0, 0, 0, 0.75)")
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.footer}>
              <div style={styles.actions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                  id="media-upload"
                />
                <button
                  style={{
                    ...styles.iconButton,
                    ...(isUploading ? styles.iconButtonDisabled : {}),
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  type="button"
                  title="Add image"
                  onMouseEnter={(e) => {
                    if (!isUploading) {
                      e.currentTarget.style.background =
                        "rgba(var(--primary-rgb, 66, 153, 225), 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Image size={20} />
                </button>
                <button
                  style={{
                    ...styles.iconButton,
                    ...(isUploading ? styles.iconButtonDisabled : {}),
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  type="button"
                  title="Add video"
                  onMouseEnter={(e) => {
                    if (!isUploading) {
                      e.currentTarget.style.background =
                        "rgba(var(--primary-rgb, 66, 153, 225), 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Video size={20} />
                </button>
              </div>

              <div style={styles.rightSection}>
                <span
                  style={
                    isOverLimit
                      ? styles.charCounterOverLimit
                      : styles.charCounter
                  }
                >
                  {charCount} / {MAX_LENGTH}
                </span>
                <button
                  style={{
                    ...styles.postButton,
                    ...(!canSubmit ? styles.postButtonDisabled : {}),
                  }}
                  id="post-btn"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  onMouseEnter={(e) => {
                    if (canSubmit) {
                      e.currentTarget.style.opacity = "0.9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = canSubmit ? "1" : "0.5";
                  }}
                >
                  {isSubmitting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
