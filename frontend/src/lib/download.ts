// Download helpers shared by the History list and the application page.
// Use the File System Access API where available (save dialog / remembered folder),
// otherwise fall back to a plain link download.

export async function smartDownload(url: string, filename: string): Promise<void> {
  if ("showSaveFilePicker" in window) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("fetch failed");
      const blob = await response.blob();
      const ext = filename.endsWith(".docx") ? ".docx" : ".pdf";
      const mimeType =
        ext === ".docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Document", accept: { [mimeType]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("resume-master-dl", 1);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore("handles");
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function loadSavedDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return await new Promise((resolve) => {
      const req = db.transaction("handles").objectStore("handles").get("download-dir");
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function persistDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "download-dir");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export async function smartDownloadBoth(
  resumeUrl: string,
  resumeFilename: string,
  coverUrl: string,
  coverFilename: string,
  onSuccess: (msg: string) => void
): Promise<void> {
  if ("showDirectoryPicker" in window) {
    try {
      const [resumeBlob, coverBlob] = await Promise.all([
        fetch(resumeUrl).then((r) => r.blob()),
        fetch(coverUrl).then((r) => r.blob()),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let dirHandle: any = await loadSavedDirHandle();
      if (dirHandle) {
        try {
          const perm = await dirHandle.requestPermission({ mode: "readwrite" });
          if (perm !== "granted") dirHandle = null;
        } catch {
          dirHandle = null;
        }
      }
      if (!dirHandle) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dirHandle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
        await persistDirHandle(dirHandle);
      }
      for (const [blob, name] of [
        [resumeBlob, resumeFilename],
        [coverBlob, coverFilename],
      ] as [Blob, string][]) {
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      onSuccess("Resume and cover letter downloaded successfully.");
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  await smartDownload(resumeUrl, resumeFilename);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await smartDownload(coverUrl, coverFilename);
  onSuccess("Resume and cover letter downloaded.");
}
