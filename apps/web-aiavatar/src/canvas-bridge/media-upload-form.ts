/** WebKit can drop multipart bodies that contain a disk-backed File (bug 319985). */
export function studioMediaUploadForm(file: File): FormData {
  const form = new FormData();
  // A Blob slice avoids WebKit's file-path upload branch without reading a large video into JS memory.
  form.append('file', file.slice(0, file.size, file.type), file.name);
  return form;
}
