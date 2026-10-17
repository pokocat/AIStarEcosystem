import { redirect } from 'next/navigation';
/** Preserve old bookmarks, search focus and IP selection parameters. */
export default async function IpManagementPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(v => query.append(key,v));
    else if (value !== undefined) query.set(key,value);
  }
  query.set('tab','ips');
  redirect(`/assets?${query}`);
}
