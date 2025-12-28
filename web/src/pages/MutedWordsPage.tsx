import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, X, Plus } from "lucide-react";
import { AppLayout } from "../components/layout";
import { usersApi } from "../lib/api";
import type { MutedWordEntry } from "../lib/api";

const MAX_MUTED_WORDS = 200;

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    position: "sticky" as const,
    top: 0,
    background: "rgba(var(--background-rgb, 254, 254, 254), 0.85)",
    backdropFilter: "blur(12px)",
    zIndex: 10,
  } as React.CSSProperties,
  backButton: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--foreground, #2d3748)",
  } as React.CSSProperties,
  title: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--foreground, #2d3748)",
    margin: 0,
  } as React.CSSProperties,
  container: {
    padding: "16px",
  } as React.CSSProperties,
  description: {
    fontSize: "14px",
    color: "var(--muted-foreground, #718096)",
    marginBottom: "20px",
    lineHeight: 1.5,
  } as React.CSSProperties,
  form: {
    background: "var(--card, #fefefe)",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "20px",
  } as React.CSSProperties,
  inputRow: {
    display: "flex",
    gap: "12px",
    marginBottom: "12px",
  } as React.CSSProperties,
  inputGroup: {
    flex: 1,
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "var(--foreground, #2d3748)",
    marginBottom: "6px",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "8px",
    fontSize: "15px",
    background: "var(--background, #fefefe)",
    color: "var(--foreground, #2d3748)",
    outline: "none",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  select: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: "8px",
    fontSize: "15px",
    background: "var(--background, #fefefe)",
    color: "var(--foreground, #2d3748)",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  addButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 16px",
    background: "var(--primary, #4299e1)",
    color: "var(--primary-foreground, #fff)",
    border: "none",
    borderRadius: "9999px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
  } as React.CSSProperties,
  error: {
    color: "#ef4444",
    fontSize: "13px",
    marginTop: "8px",
  } as React.CSSProperties,
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  } as React.CSSProperties,
  listItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "var(--card, #fefefe)",
    borderBottom: "1px solid var(--border, #e2e8f0)",
  } as React.CSSProperties,
  listItemContent: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  wordText: {
    fontSize: "15px",
    fontWeight: 500,
    color: "var(--foreground, #2d3748)",
  } as React.CSSProperties,
  wordMeta: {
    fontSize: "13px",
    color: "var(--muted-foreground, #718096)",
    marginTop: "2px",
  } as React.CSSProperties,
  deleteButton: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--muted-foreground, #718096)",
    transition: "color 0.2s, background 0.2s",
    flexShrink: 0,
  } as React.CSSProperties,
  emptyState: {
    padding: "40px 20px",
    textAlign: "center" as const,
    color: "var(--muted-foreground, #718096)",
    fontSize: "15px",
  } as React.CSSProperties,
  counter: {
    fontSize: "13px",
    color: "var(--muted-foreground, #718096)",
    marginBottom: "12px",
  } as React.CSSProperties,
};

export function MutedWordsPage() {
  const queryClient = useQueryClient();
  const [word, setWord] = useState("");
  const [scope, setScope] = useState<"all" | "not_following">("all");
  const [expiry, setExpiry] = useState("");
  const [formError, setFormError] = useState("");

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["userSettings"],
    queryFn: () => usersApi.getSettings(),
  });

  const mutedWords = settingsData?.data?.mutedWords ?? [];

  const updateMutation = useMutation({
    mutationFn: (newMutedWords: MutedWordEntry[]) =>
      usersApi.updateSettings({ mutedWords: newMutedWords }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings"] });
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const trimmedWord = word.trim().toLowerCase();
    if (!trimmedWord) {
      setFormError("Please enter a word or phrase");
      return;
    }

    if (trimmedWord.length > 100) {
      setFormError("Word must be 100 characters or less");
      return;
    }

    const key = `${trimmedWord}:${scope}`;
    const exists = mutedWords.some(
      (entry) => `${entry.word}:${entry.scope || "all"}` === key,
    );
    if (exists) {
      setFormError("That word is already muted");
      return;
    }

    if (mutedWords.length >= MAX_MUTED_WORDS) {
      setFormError(`Maximum ${MAX_MUTED_WORDS} muted words allowed`);
      return;
    }

    const entry: MutedWordEntry = {
      word: trimmedWord,
      scope,
      expiresAt: expiry ? Date.now() + parseInt(expiry) * 1000 : null,
    };

    await updateMutation.mutateAsync([entry, ...mutedWords]);
    setWord("");
    setScope("all");
    setExpiry("");
  };

  const handleDelete = async (wordToDelete: string, scopeToDelete?: string) => {
    const newMutedWords = mutedWords.filter(
      (entry) =>
        !(
          entry.word === wordToDelete &&
          (entry.scope || "all") === (scopeToDelete || "all")
        ),
    );
    await updateMutation.mutateAsync(newMutedWords);
  };

  const getScopeLabel = (s?: string) => {
    return s === "not_following" ? "From non-followed" : "From everyone";
  };

  const getExpiryLabel = (expiresAt?: number | null) => {
    if (!expiresAt) return "Forever";
    const now = Date.now();
    if (expiresAt <= now) return "Expired";
    const remaining = expiresAt - now;
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return "< 1h remaining";
  };

  return (
    <AppLayout showPostButton={false}>
      <div style={styles.header}>
        <Link to="/settings" style={styles.backButton}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={styles.title}>Muted words</h1>
      </div>

      <div style={styles.container}>
        <p style={styles.description}>
          Posts containing muted words won't appear in your timeline. You can
          choose to mute words from everyone or only from people you don't
          follow.
        </p>

        <form style={styles.form} onSubmit={handleAdd}>
          <div style={styles.inputRow}>
            <div style={{ ...styles.inputGroup, flex: 2 }}>
              <label style={styles.label}>Word or phrase</label>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Enter word to mute"
                style={styles.input}
                maxLength={100}
              />
            </div>
          </div>

          <div style={styles.inputRow}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Mute from</label>
              <select
                value={scope}
                onChange={(e) =>
                  setScope(e.target.value as "all" | "not_following")
                }
                style={styles.select}
              >
                <option value="all">Everyone</option>
                <option value="not_following">People I don't follow</option>
              </select>
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Duration</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={styles.select}
              >
                <option value="">Forever</option>
                <option value="86400">24 hours</option>
                <option value="604800">7 days</option>
                <option value="2592000">30 days</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            style={{
              ...styles.addButton,
              opacity: updateMutation.isPending ? 0.7 : 1,
            }}
            disabled={updateMutation.isPending}
          >
            <Plus size={16} />
            Add muted word
          </button>

          {formError && <div style={styles.error}>{formError}</div>}
        </form>

        <div style={styles.counter}>
          {mutedWords.length} / {MAX_MUTED_WORDS} words muted
        </div>

        {isLoading ? (
          <div style={styles.emptyState}>Loading...</div>
        ) : mutedWords.length === 0 ? (
          <div style={styles.emptyState}>No muted words yet</div>
        ) : (
          <div style={styles.list}>
            {mutedWords.map((entry, index) => (
              <div
                key={`${entry.word}-${entry.scope}-${index}`}
                style={styles.listItem}
              >
                <div style={styles.listItemContent}>
                  <div style={styles.wordText}>{entry.word}</div>
                  <div style={styles.wordMeta}>
                    {getScopeLabel(entry.scope)} &middot;{" "}
                    {getExpiryLabel(entry.expiresAt)}
                  </div>
                </div>
                <button
                  style={styles.deleteButton}
                  onClick={() => handleDelete(entry.word, entry.scope)}
                  title="Remove"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ef4444";
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color =
                      "var(--muted-foreground, #718096)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
