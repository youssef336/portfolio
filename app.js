function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.content : "";
}

function getApkFileNameFromHref(href) {
  if (!href) {
    return "";
  }

  try {
    const url = new URL(href, window.location.href);
    const segments = url.pathname.split("/").filter(Boolean);
    const apksIndex = segments.lastIndexOf("apks");

    if (apksIndex !== -1 && segments[apksIndex + 1]) {
      return decodeURIComponent(segments[apksIndex + 1]);
    }

    return segments.length
      ? decodeURIComponent(segments[segments.length - 1])
      : "";
  } catch {
    return "";
  }
}

function formatDisplayDate(isoDate) {
  if (!isoDate) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

function getUpdateTimeElements() {
  return Array.from(document.querySelectorAll("[data-site-updated]"));
}

function getUpdatedChipElements() {
  return Array.from(document.querySelectorAll("[data-apk-updated-chip]"));
}

function formatHoursAgo(isoDate) {
  if (!isoDate) {
    return "Updated";
  }

  const updatedTime = new Date(isoDate).getTime();
  const nowTime = Date.now();

  if (!Number.isFinite(updatedTime) || updatedTime > nowTime) {
    return "Updated";
  }

  const diffMs = nowTime - updatedTime;
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  return `Updated ${diffHours}h ago`;
}

function updateLastUpdatedLabel(isoDate) {
  const timeElements = getUpdateTimeElements();

  if (!timeElements.length || !isoDate) {
    return;
  }

  const label = formatDisplayDate(isoDate);

  if (!label) {
    return;
  }

  for (const element of timeElements) {
    element.dateTime = isoDate;
    element.textContent = label;
  }
}

function updateUpdatedChips(isoDate) {
  const chips = getUpdatedChipElements();

  if (!chips.length) {
    return;
  }

  const text = formatHoursAgo(isoDate);

  for (const chip of chips) {
    chip.textContent = text;
  }
}

async function fetchLatestApkUpdate() {
  const repo = getMetaContent("github-repo");
  const branch = getMetaContent("github-branch") || "main";
  const apkPath = getMetaContent("github-apk-path") || "apks";
  const url = new URL(`https://api.github.com/repos/${repo}/commits`);
  url.searchParams.set("sha", branch);
  url.searchParams.set("path", apkPath);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("_", Date.now().toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("GitHub API request failed");
  }

  const commits = await response.json();
  const latest = Array.isArray(commits) && commits.length ? commits[0] : null;

  return latest?.commit?.committer?.date || latest?.commit?.author?.date || "";
}

async function fetchApkAssetsFromLatestRelease() {
  const repo = getMetaContent("github-repo");
  const url = new URL(`https://api.github.com/repos/${repo}/releases/latest`);
  url.searchParams.set("_", Date.now().toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("GitHub release request failed");
  }

  const release = await response.json();
  const assets = Array.isArray(release?.assets) ? release.assets : [];

  return assets.filter(
    (asset) =>
      asset &&
      typeof asset.name === "string" &&
      asset.name.toLowerCase().endsWith(".apk") &&
      typeof asset.browser_download_url === "string",
  );
}

function updateApkDownloadLinks(assets) {
  const fileMap = new Map(
    assets.map((asset) => [
      asset.name.toLowerCase(),
      asset.browser_download_url,
    ]),
  );

  const buttons = document.querySelectorAll("a.btn[download]");

  for (const button of buttons) {
    const currentName = getApkFileNameFromHref(
      button.getAttribute("href") || "",
    );

    if (!currentName) {
      continue;
    }

    const githubFileUrl = fileMap.get(currentName.toLowerCase());

    if (!githubFileUrl) {
      continue;
    }

    button.href = githubFileUrl;
    button.target = "_blank";
    button.rel = "noopener";
  }
}

async function loadLastUpdated() {
  const repo = getMetaContent("github-repo");

  if (!repo) {
    return;
  }

  try {
    const latestApkUpdate = await fetchLatestApkUpdate();
    updateLastUpdatedLabel(latestApkUpdate);
    updateUpdatedChips(latestApkUpdate);
  } catch {
    // Keep existing fallback text if GitHub API is unavailable.
  }

  try {
    const assets = await fetchApkAssetsFromLatestRelease();
    updateApkDownloadLinks(assets);
  } catch {
    // Keep local links if release assets are unavailable.
  }
}

document.addEventListener("DOMContentLoaded", loadLastUpdated);
