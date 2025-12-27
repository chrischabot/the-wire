const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "..", "src", "index.ts");
const pagesDir = path.join(__dirname, "..", "src", "pages");

const content = fs.readFileSync(indexPath, "utf-8");
const lines = content.split("\n");

function extractRouteTemplate(startLineNum, endLineNum) {
  const routeLines = lines.slice(startLineNum - 1, endLineNum);
  const routeContent = routeLines.join("\n");

  const match = routeContent.match(
    /return c\.html\(`([\s\S]*)`\s*\);?\s*\}\);?$/,
  );
  if (match) {
    return match[1];
  }
  return null;
}

const pages = [
  {
    name: "post",
    func: "getPostPage",
    start: 130,
    end: 1012,
    param: "postId: string",
  },
  {
    name: "settings",
    func: "getSettingsPage",
    start: 1015,
    end: 1381,
    param: null,
  },
  {
    name: "settings",
    func: "getMutedSettingsPage",
    start: 1383,
    end: 1720,
    param: null,
    append: true,
  },
  { name: "admin", func: "getAdminPage", start: 1723, end: 2579, param: null },
  {
    name: "profile",
    func: "getProfilePage",
    start: 2582,
    end: 3179,
    param: "handle: string",
  },
  {
    name: "profile",
    func: "getFollowersPage",
    start: 3182,
    end: 3346,
    param: "handle: string",
    append: true,
  },
  {
    name: "profile",
    func: "getFollowingPage",
    start: 3349,
    end: 3513,
    param: "handle: string",
    append: true,
  },
];

const fileContents = {};

for (const page of pages) {
  console.log(`Extracting ${page.func}...`);

  const template = extractRouteTemplate(page.start, page.end);
  if (!template) {
    console.error(`  Failed to extract template`);
    continue;
  }

  console.log(`  Template length: ${template.length} chars`);

  const paramDecl = page.param || "";
  const funcCode = `
export function ${page.func}(${paramDecl}): string {
  return \`${template}\`;
}
`;

  if (!fileContents[page.name]) {
    fileContents[page.name] = {
      header: `import { getBottomNavHtml } from "../shared/bottom-nav";\n`,
      functions: [],
    };
  }
  fileContents[page.name].functions.push(funcCode);
}

for (const [name, data] of Object.entries(fileContents)) {
  const filePath = path.join(pagesDir, `${name}.ts`);
  const content = data.header + data.functions.join("\n");
  fs.writeFileSync(filePath, content);
  console.log(`Created ${name}.ts`);
}

console.log("\nDone!");
