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

async function fetchApkFilesFromGitHub() {
  const repo = getMetaContent("github-repo");
  const branch = getMetaContent("github-branch") || "main";
  const apkPath = getMetaContent("github-apk-path") || "apks";

  const url = new URL(
    `https://api.github.com/repos/${repo}/contents/${apkPath}`,
  );
  url.searchParams.set("ref", branch);
  url.searchParams.set("_", Date.now().toString());

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error("GitHub APK content request failed");
  }

  const files = await response.json();
  return Array.isArray(files) ? files : [];
}

function updateApkDownloadLinks(files) {
  const fileMap = new Map(
    files
      .filter(
        (file) =>
          file && file.type === "file" && file.name && file.download_url,
      )
      .map((file) => [file.name.toLowerCase(), file.download_url]),
  );

  const buttons = document.querySelectorAll("a.btn[download]");

  for (const button of buttons) {
    const currentName = getApkFileNameFromHref(
      button.getAttribute("href") || "",
    );

    if (!currentName) {
      continue;
    }

  