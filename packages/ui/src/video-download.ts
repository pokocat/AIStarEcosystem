export function isWeChatBrowser(userAgent: string): boolean {
  return /MicroMessenger/i.test(userAgent);
}

export function openVideoDownload(ticket: string): void {
  // The same URL opens in the system browser without carrying an account session.
  // Keep the short-lived grant in the fragment so it stays out of page requests and referrers.
  window.location.assign(`/video-download#${encodeURIComponent(ticket)}`);
}
