import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function versionUnits(version) {
  const match = /^(\d+)\.(\d)$/.exec(String(version));
  if (!match)
    throw new Error(`Invalid version: ${version}. Expected one decimal place.`);
  const units = Number(match[1]) * 10 + Number(match[2]);
  if (!Number.isSafeInteger(units))
    throw new Error("Version exceeds the supported range.");
  return units;
}

export function nextVersion(currentVersion) {
  const units = versionUnits(currentVersion) + 1;
  return `${Math.floor(units / 10)}.${units % 10}`;
}

export function htmlVersion(html) {
  const match =
    /<meta\s+name="application-version"\s+content="([^"]+)"\s*\/?\s*>/i.exec(
      html,
    );
  if (!match)
    throw new Error("The page is missing its application-version metadata.");
  versionUnits(match[1]);
  return match[1];
}

export function stampVersion(html, version) {
  versionUnits(version);
  htmlVersion(html);
  let labels = 0;
  const updated = html
    .replace(
      /(<meta\s+name="application-version"\s+content=")[^"]+("\s*\/?\s*>)/i,
      `$1${version}$2`,
    )
    .replace(
      /(<span(?: class="splash-version")?>)Version \d+\.\d+(<\/span>)/g,
      (_, before, after) => {
        labels++;
        return `${before}Version ${version}${after}`;
      },
    );
  if (labels !== 2)
    throw new Error(
      `Expected splash and footer version labels, found ${labels}.`,
    );
  return updated;
}

export async function build({ root, env = process.env } = {}) {
  root ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const sourceVersion = htmlVersion(html);
  // Build-time state is restored by the local Netlify cache plugin.
  // Never call the public site: deployment access controls can return HTTP 401.
  const context = env.CONTEXT || "production";
  const scope =
    context === "production"
      ? "production"
      : `${context}-${env.BRANCH || "preview"}`;
  const statePath = path.join(
    root,
    ".netlify",
    "version-state",
    `${encodeURIComponent(scope)}.json`,
  );
  let previous = null;
  try {
    previous = JSON.parse(await readFile(statePath, "utf8")).version;
    versionUnits(previous);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const baseline =
    previous && versionUnits(previous) > versionUnits(sourceVersion)
      ? previous
      : sourceVersion;
  let minimumVersion = sourceVersion;
  try {
    const config = JSON.parse(
      await readFile(path.join(root, "release.json"), "utf8"),
    );
    versionUnits(config.minimumVersion);
    if (
      !Array.isArray(config.notes) ||
      config.notes.length < 1 ||
      config.notes.length > 3 ||
      config.notes.some((note) => typeof note !== "string" || !note.trim())
    ) {
      throw new Error(
        "Release notes must contain one to three non-empty sentences.",
      );
    }
    const sentences = [
      ...new Intl.Segmenter("en", { granularity: "sentence" }).segment(
        config.notes.join(" "),
      ),
    ];
    if (sentences.length > 3)
      throw new Error("Release notes must contain at most three sentences.");
    minimumVersion = config.minimumVersion;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const incremented = nextVersion(baseline);
  const version =
    versionUnits(minimumVersion) > versionUnits(incremented)
      ? minimumVersion
      : incremented;
  const output = path.join(root, "dist");
  await mkdir(output, { recursive: true });
  const componentApp = html.includes('id=\"root\"');
  const stamped = componentApp
    ? html.replace(
        /(<meta name=\"application-version\" content=\")[^\"]+(\")/,
        (_, before, after) => before + version + after,
      )
    : stampVersion(html, version);
  await writeFile(path.join(output, "index.html"), stamped);
  const release = {
    version,
    previousVersion: baseline,
    commit: env.COMMIT_REF || null,
    builtAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(output, "version.json"),
    JSON.stringify(release, null, 2) + "\n",
  );
  await mkdir(path.join(root, ".netlify"), { recursive: true });
  await writeFile(
    path.join(root, ".netlify", "build-version.json"),
    JSON.stringify(release, null, 2) + "\n",
  );
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ version }) + "\n");
  console.log(`Bridges Manufacturing: ${baseline} -> ${version}`);
  return { version, output };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  build().catch((error) => {
    console.error(`Version build failed: ${error.message}`);
    process.exitCode = 1;
  });
}
