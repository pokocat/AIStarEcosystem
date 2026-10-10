import type { StudioConversationSnapshot } from '@ai-star-eco/types/ip-studio-share';
/** The same plain-text renderer serves owner preview and anonymous readers; no executable generated HTML. */
export function StudioConversationTranscript({snapshot}:{snapshot:StudioConversationSnapshot}) {
  return <div className="studio-shared-transcript">
    {snapshot.turns.map((turn,i)=><article className={`studio-turn studio-turn-${turn.role}`} key={i}><small>{turn.role==='user'?'创作者':'Studio'}</small><p>{turn.content}</p></article>)}
    {snapshot.plan&&<section className="studio-shared-plan"><h2>创作建议</h2><p>{snapshot.plan.summary}</p>{snapshot.plan.notes?.map((n,i)=><p key={`n${i}`}>{n}</p>)}
      {snapshot.plan.questions.map((q,i)=><p key={`q${i}`}>{q}</p>)}
      {snapshot.plan.steps.map(s=><article key={s.id}><h3>{s.title}</h3><p>{s.prompt}</p>{!!s.unresolvedReferences?.length&&<small>继续创作时需重新选择参考素材</small>}</article>)}
    </section>}
  </div>;
}
