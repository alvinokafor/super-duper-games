// Opens the phone's share sheet, or copies the link where sharing isn't available.
export async function shareOrCopy(data: { title: string; text?: string; url: string }): Promise<"shared" | "copied" | "cancelled"> {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  await navigator.clipboard.writeText(data.text ? `${data.text} ${data.url}` : data.url);
  return "copied";
}
