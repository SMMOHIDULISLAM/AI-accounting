export const today = () => new Date().toISOString().slice(0, 10);
export function saveFile(name: string, bytes: BlobPart, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
