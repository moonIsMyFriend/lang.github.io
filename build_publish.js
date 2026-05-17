const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname);
const SRC_ROOT = path.join(ROOT_DIR, "src");
const PUBLISH_ROOT = path.join(ROOT_DIR, "publish");
const IS_WIN = process.platform === "win32";

const SKIP_EXT = new Set([".md"]);

/** Windows: .cmd 는 cmd.exe 로 실행 (execFileSync 단독 호출 시 EINVAL) */
function runCli(command, args) {
  if (IS_WIN) {
    execFileSync("cmd.exe", ["/c", command, ...args], { stdio: "inherit" });
  } else {
    execFileSync(command, args, { stdio: "inherit" });
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function walk(dir) {
  const results = [];

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function minifyHtml(src, dest) {
  ensureDir(path.dirname(dest));

  runCli("html-minifier-terser", [
    src,
    "--collapse-whitespace",
    "--remove-comments",
    "--remove-redundant-attributes",
    "--remove-script-type-attributes",
    "--remove-style-link-type-attributes",
    "--minify-css",
    "true",
    "--minify-js",
    "true",
    "-o",
    dest,
  ]);
}

function minifyCss(src, dest) {
  ensureDir(path.dirname(dest));

  runCli("cleancss", ["-o", dest, src]);
}

function obfuscateJs(src, dest) {
  ensureDir(path.dirname(dest));

  runCli("javascript-obfuscator", [
    src,
    "--output",
    dest,
    "--compact",
    "true",
    "--control-flow-flattening",
    "true",
    "--string-array",
    "true",
    "--string-array-encoding",
    "base64",
    "--dead-code-injection",
    "true",
    "--rename-globals",
    "false",
  ]);
}

function parseFolderArg() {
  const raw = process.argv[2];

  if (!raw) {
    console.error("사용법: node build_publish.js <src 하위 폴더>");
    console.error("예: node build_publish.js com");
    console.error("    node build_publish.js fr/kn/pron");
    process.exit(1);
  }

  const normalized = path.normalize(raw).replace(/^(\.\.(\/|\\|$))+/, "");
  const srcDir = path.resolve(SRC_ROOT, normalized);
  const srcRootResolved = path.resolve(SRC_ROOT);
  const relative = path.relative(srcRootResolved, srcDir);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    console.error("[ERROR] src 밖의 경로는 지정할 수 없습니다.");
    process.exit(1);
  }

  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    console.error(`[ERROR] 폴더가 없습니다: src/${normalized.replace(/\\/g, "/")}`);
    process.exit(1);
  }

  return {
    folderKey: relative.split(path.sep).join("/"),
    srcDir,
  };
}

function collectFiles(srcDir) {
  return walk(srcDir).filter(function (filePath) {
    return !SKIP_EXT.has(path.extname(filePath).toLowerCase());
  });
}

function buildFile(srcFile, outFile) {
  const ext = path.extname(srcFile).toLowerCase();

  if (ext === ".html") {
    minifyHtml(srcFile, outFile);
    return "html";
  }
  if (ext === ".css") {
    minifyCss(srcFile, outFile);
    return "css";
  }
  if (ext === ".js") {
    obfuscateJs(srcFile, outFile);
    return "js";
  }

  copyFile(srcFile, outFile);
  return "copy";
}

function build() {
  const { folderKey, srcDir } = parseFolderArg();
  const outDir = path.join(PUBLISH_ROOT, folderKey);

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  ensureDir(outDir);

  const files = collectFiles(srcDir);

  if (files.length === 0) {
    console.warn(`[WARN] 처리할 파일이 없습니다: src/${folderKey}`);
  }

  const counts = { html: 0, css: 0, js: 0, copy: 0 };

  for (const srcFile of files) {
    const relativePath = path.relative(srcDir, srcFile);
    const outFile = path.join(outDir, relativePath);
    const kind = buildFile(srcFile, outFile);

    counts[kind] += 1;
    console.log(`[BUILD] ${folderKey}/${relativePath.replace(/\\/g, "/")} (${kind})`);
  }

  console.log(`\n[DONE] publish/${folderKey}/`);
  console.log(
    `  html: ${counts.html}, css: ${counts.css}, js: ${counts.js}, copy: ${counts.copy}`
  );
}

build();
