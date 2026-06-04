const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const readmePath = path.join(repoRoot, 'README.md');
const readmeCnPath = path.join(repoRoot, 'README_CN.md');
const composePath = path.join(repoRoot, 'docker-compose.yml');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function replaceOrThrow(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Expected pattern not found for ${label}`);
  }
  return content.replace(pattern, replacement);
}

function syncReadme(content, version, localeLabel) {
  let next = content;
  next = replaceOrThrow(
    next,
    /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[0-9]+\.[0-9]+\.[0-9]+-blue\)/,
    `![Version](https://img.shields.io/badge/version-${version}-blue)`,
    `${localeLabel} badge`
  );
  next = replaceOrThrow(
    next,
    /Download `智方云cubecloud Setup [0-9]+\.[0-9]+\.[0-9]+\.exe`/,
    `Download \`智方云cubecloud Setup ${version}.exe\``,
    `${localeLabel} download step`
  );
  next = replaceOrThrow(
    next,
    /# Output: dist\/智方云cubecloud Setup [0-9]+\.[0-9]+\.[0-9]+\.exe/,
    `# Output: dist/智方云cubecloud Setup ${version}.exe`,
    `${localeLabel} build output`
  );
  next = replaceOrThrow(
    next,
    /This means version `[0-9]+\.[0-9]+\.[0-9]+` can be offered with both choices live at the same time:/,
    `This means version \`${version}\` can be offered with both choices live at the same time:`,
    `${localeLabel} dual delivery note`
  );
  return next;
}

function syncReadmeCn(content, version, localeLabel) {
  let next = content;
  next = replaceOrThrow(
    next,
    /!\[版本\]\(https:\/\/img\.shields\.io\/badge\/版本-[0-9]+\.[0-9]+\.[0-9]+-blue\)/,
    `![版本](https://img.shields.io/badge/版本-${version}-blue)`,
    `${localeLabel} badge`
  );
  next = replaceOrThrow(
    next,
    /下载 `智方云cubecloud Setup [0-9]+\.[0-9]+\.[0-9]+\.exe`/,
    `下载 \`智方云cubecloud Setup ${version}.exe\``,
    `${localeLabel} download step`
  );
  next = replaceOrThrow(
    next,
    /# 输出路径：dist\/智方云cubecloud Setup [0-9]+\.[0-9]+\.[0-9]+\.exe/,
    `# 输出路径：dist/智方云cubecloud Setup ${version}.exe`,
    `${localeLabel} build output`
  );
  next = replaceOrThrow(
    next,
    /这意味着 `[0-9]+\.[0-9]+\.[0-9]+` 版本可以同时提供两种选择：/,
    `这意味着 \`${version}\` 版本可以同时提供两种选择：`,
    `${localeLabel} dual delivery note`
  );
  return next;
}

function syncCompose(content, version) {
  return replaceOrThrow(
    content,
    /image:\s*cubecloud-build-service:[0-9]+\.[0-9]+\.[0-9]+/,
    `image: cubecloud-build-service:${version}`,
    'docker compose image tag'
  );
}

function main() {
  const packageJson = JSON.parse(readUtf8(packageJsonPath));
  const version = packageJson.version;

  const readme = readUtf8(readmePath);
  const readmeCn = readUtf8(readmeCnPath);
  const compose = readUtf8(composePath);

  const nextReadme = syncReadme(readme, version, 'README.md');
  const nextReadmeCn = syncReadmeCn(readmeCn, version, 'README_CN.md');
  const nextCompose = syncCompose(compose, version);

  writeUtf8(readmePath, nextReadme);
  writeUtf8(readmeCnPath, nextReadmeCn);
  writeUtf8(composePath, nextCompose);

  console.log(`Release metadata synced to version ${version}`);
}

main();
