import type { Metadata } from 'next';
import { StudioConversationPublic } from '@/ip/studio-conversation-public';
export const metadata:Metadata={title:'对话分享 · AI IP Studio',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function ConversationSharePage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;return <StudioConversationPublic token={token}/>;
}
