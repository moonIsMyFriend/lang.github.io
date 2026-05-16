const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname);
const SRC_DIR = path.join(ROOT_DIR, "styletest");
const ENTRY_HTML = path.join(SRC_DIR, "mobile_earth_moon_page.html");
const OUT_DIR = path.join(ROOT_DIR, "publish");
const OUT_HTML = path.join(OUT_DIR, "index.html");
const ASSET_DIR = path.join(SRC_DIR, "earth_moon_scroll");
const IS_WIN = process.platform === "win32";

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

function collectAssetFiles() {
  if (!fs.existsSync(ASSET_DIR)) {
    console.error("[ERROR] earth_moon_scroll 폴더가 없습니다.");
    process.exit(1);
  }

  return walk(ASSET_DIR).filter(function (filePath) {
    return !filePath.endsWith(".md");
  });
}

function build() {
  if (!fs.existsSync(ENTRY_HTML)) {
    console.error("[ERROR] 진입 HTML이 없습니다: styletest/mobile_earth_moon_page.html");
    process.exit(1);
  }

  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }

  ensureDir(OUT_DIR);

  console.log("[BUILD] mobile_earth_moon_page.html → publish/index.html");
  minifyHtml(ENTRY_HTML, OUT_HTML);

  const assetFiles = collectAssetFiles();

  for (const srcFile of assetFiles) {
    const relativePath = path.relative(SRC_DIR, srcFile);
    const outFile = path.join(OUT_DIR, relativePath);
    const ext = path.extname(srcFile).toLowerCase();

    console.log(`[BUILD] ${relativePath}`);

    if (ext === ".css") {
      minifyCss(srcFile, outFile);
    } else if (ext === ".js") {
      obfuscateJs(srcFile, outFile);
    } else {
      copyFile(srcFile, outFile);
    }
  }

  console.log("\n[DONE] publish/");
  console.log("  index.html");
  console.log("  earth_moon_scroll/ (css, js)");
}

build();
