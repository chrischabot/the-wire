import { describe, it, expect } from "vitest";
import { app } from "../../src/index";

const mockEnv = {
  ENVIRONMENT: "test",
  JWT_EXPIRY_HOURS: "24",
  MAX_NOTE_LENGTH: "280",
  FEED_PAGE_SIZE: "20",
  SESSIONS_KV: {
    get: async () => null,
    put: async () => {},
    delete: async () => {},
  },
  MEDIA_BUCKET: {
    get: async () => null,
    put: async () => {},
  },
  ASSETS: {
    fetch: async () =>
      new Response("<html><body>404 - Page Not Found</body></html>", {
        headers: { "Content-Type": "text/html" },
      }),
  },
};

describe("The Wire Worker", () => {
  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const res = await app.request("/health", {}, mockEnv);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("healthy");
      expect(body.data.service).toBe("the-wire");
      expect(body.data.environment).toBe("test");
    });
  });

  describe("GET /", () => {
    it("should return landing page HTML", async () => {
      const res = await app.request("/", {}, mockEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("The Wire");
      expect(html).toContain("Share your notes");
    });
  });

  describe("GET /api", () => {
    it("should return API info", async () => {
      const res = await app.request("/api", {}, mockEnv);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("The Wire API");
      expect(body.data.version).toBe("1.0.0");
      expect(body.data.endpoints).toBeDefined();
    });
  });

  describe("SPA fallback", () => {
    it("should serve SPA for unknown non-API routes", async () => {
      const res = await app.request("/unknown-route", {}, mockEnv);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/html");
    });
  });

  describe("API 404 handling", () => {
    it("should return 404 JSON for unknown API routes", async () => {
      const res = await app.request("/api/unknown", {}, mockEnv);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Not found");
    });
  });
});
