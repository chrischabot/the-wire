const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "src", "index.ts");
let content = fs.readFileSync(indexPath, "utf-8");

// Add new imports after existing page imports
const importInsertPoint = `import { getHomePage } from "./pages/home";`;
const newImports = `import { getHomePage } from "./pages/home";
import { getPostPage } from "./pages/post";
import { getSettingsPage, getMutedSettingsPage } from "./pages/settings";
import { getAdminPage } from "./pages/admin";
import {
  getProfilePage,
  getFollowersPage,
  getFollowingPage,
} from "./pages/profile";`;

content = content.replace(importInsertPoint, newImports);

// Remove the getBottomNavHtml import since pages now import it themselves
// Actually keep it - it might be used elsewhere

// Helper to find and replace route handlers
function replaceRouteHandler(routePattern, newHandler) {
  // Find the route start
  const routeRegex = new RegExp(
    `(${routePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})([\\s\\S]*?)(?=\\n(?:\\/\\/|app\\.|const |export ))`,
    "m",
  );

  const match = content.match(routeRegex);
  if (match) {
    const fullMatch = match[0];
    content = content.replace(fullMatch, newHandler);
    return true;
  }
  return false;
}

// Replace /post/:id route (line 130-1012)
const postRouteStart = content.indexOf('app.get("/post/:id"');
const settingsRouteStart = content.indexOf(
  'app.get("/settings"',
  postRouteStart + 1,
);
if (postRouteStart !== -1 && settingsRouteStart !== -1) {
  // Find the end of post route (the line before settings route)
  const postRouteContent = content.substring(
    postRouteStart,
    settingsRouteStart,
  );
  const newPostRoute = `app.get("/post/:id", (c) => {
  const postId = c.req.param("id");
  return c.html(getPostPage(postId));
});

// Settings page
`;
  content =
    content.substring(0, postRouteStart) +
    newPostRoute +
    content.substring(settingsRouteStart);
}

// Replace /settings route
const settingsStartNew = content.indexOf('app.get("/settings"');
const mutedRouteStart = content.indexOf(
  'app.get("/settings/muted"',
  settingsStartNew + 1,
);
if (settingsStartNew !== -1 && mutedRouteStart !== -1) {
  const settingsContent = content.substring(settingsStartNew, mutedRouteStart);
  const newSettingsRoute = `app.get("/settings", (c) => {
  return c.html(getSettingsPage());
});

`;
  content =
    content.substring(0, settingsStartNew) +
    newSettingsRoute +
    content.substring(mutedRouteStart);
}

// Replace /settings/muted route
const mutedStartNew = content.indexOf('app.get("/settings/muted"');
const adminRouteStart = content.indexOf('app.get("/admin"', mutedStartNew + 1);
if (mutedStartNew !== -1 && adminRouteStart !== -1) {
  const mutedContent = content.substring(mutedStartNew, adminRouteStart);
  const newMutedRoute = `app.get("/settings/muted", (c) => {
  return c.html(getMutedSettingsPage());
});

// Admin Dashboard
`;
  content =
    content.substring(0, mutedStartNew) +
    newMutedRoute +
    content.substring(adminRouteStart);
}

// Replace /admin route
const adminStartNew = content.indexOf('app.get("/admin"');
const profileRouteStart = content.indexOf(
  'app.get("/u/:handle"',
  adminStartNew + 1,
);
if (adminStartNew !== -1 && profileRouteStart !== -1) {
  const adminContent = content.substring(adminStartNew, profileRouteStart);
  const newAdminRoute = `app.get("/admin", (c) => {
  return c.html(getAdminPage());
});

// Public profile page - MUST be before API routes to avoid conflicts
`;
  content =
    content.substring(0, adminStartNew) +
    newAdminRoute +
    content.substring(profileRouteStart);
}

// Replace /u/:handle route
const profileStartNew = content.indexOf('app.get("/u/:handle"');
const followersRouteStart = content.indexOf(
  'app.get("/u/:handle/followers"',
  profileStartNew + 1,
);
if (profileStartNew !== -1 && followersRouteStart !== -1) {
  const profileContent = content.substring(
    profileStartNew,
    followersRouteStart,
  );
  const newProfileRoute = `app.get("/u/:handle", (c) => {
  const handle = c.req.param("handle");
  return c.html(getProfilePage(handle));
});

// Followers page
`;
  content =
    content.substring(0, profileStartNew) +
    newProfileRoute +
    content.substring(followersRouteStart);
}

// Replace /u/:handle/followers route
const followersStartNew = content.indexOf('app.get("/u/:handle/followers"');
const followingRouteStart = content.indexOf(
  'app.get("/u/:handle/following"',
  followersStartNew + 1,
);
if (followersStartNew !== -1 && followingRouteStart !== -1) {
  const followersContent = content.substring(
    followersStartNew,
    followingRouteStart,
  );
  const newFollowersRoute = `app.get("/u/:handle/followers", (c) => {
  const handle = c.req.param("handle");
  return c.html(getFollowersPage(handle));
});

// Following page
`;
  content =
    content.substring(0, followersStartNew) +
    newFollowersRoute +
    content.substring(followingRouteStart);
}

// Replace /u/:handle/following route - find where it ends (before /api route)
const followingStartNew = content.indexOf('app.get("/u/:handle/following"');
const apiRouteStart = content.indexOf(
  "// API version info",
  followingStartNew + 1,
);
if (followingStartNew !== -1 && apiRouteStart !== -1) {
  const followingContent = content.substring(followingStartNew, apiRouteStart);
  const newFollowingRoute = `app.get("/u/:handle/following", (c) => {
  const handle = c.req.param("handle");
  return c.html(getFollowingPage(handle));
});

`;
  content =
    content.substring(0, followingStartNew) +
    newFollowingRoute +
    content.substring(apiRouteStart);
}

fs.writeFileSync(indexPath, content);

console.log("Done! Replaced inline templates with function calls.");
console.log("File length:", content.length, "characters");
console.log("Run 'npx tsc --noEmit' to verify TypeScript compiles.");
