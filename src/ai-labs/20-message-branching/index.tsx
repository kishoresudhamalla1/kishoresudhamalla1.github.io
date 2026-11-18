import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "../_shared/ui";
import "./styles.css";

interface AssistantReply {
  text: string;
  stopped?: boolean;
}
interface UserBranch {
  text: string;
  replies: AssistantReply[];
}
interface Stream {
  userIdx: number;
  words: string[];
  revealed: number;
}

const INITIAL: UserBranch[] = [
  {
    text: "What's the policy on carrying over leave?",
    replies: [{ text: "Unused annual leave carries over up to 5 days into the next cycle." }],
  },
];

const EDITED_REPLY = "Part-time staff carry over the same 5 days, pro-rated to their contracted hours.";
const REGENERATED_REPLY = "Up to 5 days carry over. Anything beyond that is paid out in December, not lost.";

/* One user turn, one assistant turn, each independently branchable. Editing
   the user message creates a sibling user branch with its own fresh reply.
   Regenerating creates a sibling reply under the user branch you're on.
   Neither ever overwrites what was there before, and stopping mid-stream
   keeps exactly the words that had actually appeared, not the full answer
   truncated after the fact. */
export default function MessageBranching() {
  const [branches, setBranches] = useState<UserBranch[]>(INITIAL);
  const [userIdx, setUserIdx] = useState(0);
  const [replyIdx, setReplyIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [stream, setStream] = useState<Stream | null>(null);
  const tick = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (tick.current && clearTimeout(tick.current)), []);

  // Reveal one word at a time, then land the finished reply a beat later.
  useEffect(() => {
    if (!stream) return;
    if (stream.revealed >= stream.words.length) {
      tick.current = setTimeout(() => commitReply(stream, false), 350);
      return;
    }
    tick.current = setTimeout(() => setStream((s) => (s ? { ...s, revealed: s.revealed + 1 } : s)), 65);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  const user = branches[userIdx];
  const reply = user.replies[replyIdx];

  function commitReply(s: Stream, wasStopped: boolean) {
    const text = s.words.slice(0, s.revealed).join(" ");
    const newReplyIdx = branches[s.userIdx]?.replies.length ?? 0;
    setBranches((prev) => {
      const next = [...prev];
      next[s.userIdx] = { ...next[s.userIdx], replies: [...next[s.userIdx].replies, { text, stopped: wasStopped }] };
      return next;
    });
    setUserIdx(s.userIdx);
    setReplyIdx(newReplyIdx);
    setStream(null);
  }

  const appendReply = (targetUserIdx: number, text: string) => setStream({ userIdx: targetUserIdx, words: text.split(" "), revealed: 0 });

  const startEdit = () => {
    setDraft(user.text);
    setEditing(true);
  };
  const saveEdit = () => {
    setEditing(false);
    const newUserIdx = branches.length;
    setBranches((prev) => [...prev, { text: draft, replies: [] }]);
    appendReply(newUserIdx, EDITED_REPLY);
  };
  const regenerate = () => appendReply(userIdx, REGENERATED_REPLY);

  const stopStreaming = () => {
    if (!stream) return;
    if (tick.current) clearTimeout(tick.current);
    commitReply(stream, true);
  };

  const prevUser = () => { setUserIdx((i) => Math.max(0, i - 1)); setReplyIdx(0); };
  const nextUser = () => { setUserIdx((i) => Math.min(branches.length - 1, i + 1)); setReplyIdx(0); };
  const prevReply = () => setReplyIdx((i) => Math.max(0, i - 1));
  const nextReply = () => setReplyIdx((i) => Math.min(user.replies.length - 1, i + 1));

  return (
    <div className="mb-thread">
      <div className="mb-msg mb-msg--user">
        {editing ? (
          <div className="mb-edit">
            <textarea className="lab-input" value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus />
            <div className="lab-row">
              <Button size="sm" variant="primary" onClick={saveEdit}>Save, create a branch</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <p>{user.text}</p>
            <div className="lab-row mb-msg-foot">
              {branches.length > 1 && (
                <span className="mb-pager">
                  <button type="button" onClick={prevUser} disabled={userIdx === 0} aria-label="Previous version of this message">
                    <Icon name="chevron" size={11} />
                  </button>
                  {userIdx + 1} / {branches.length}
                  <button type="button" onClick={nextUser} disabled={userIdx === branches.length - 1} aria-label="Next version of this message">
                    <Icon name="chevron" size={11} />
                  </button>
                </span>
              )}
              <button type="button" className="mb-edit-btn" onClick={startEdit} disabled={!!stream}>Edit</button>
            </div>
          </>
        )}
      </div>

      {stream && stream.userIdx === userIdx && (() => {
        const finished = stream.revealed >= stream.words.length;
        return (
          <div className="mb-msg mb-msg--assistant lab-in">
            <p className="mb-stream">
              {stream.words.slice(0, stream.revealed).join(" ")}
              {!finished && <span className="mb-caret" aria-hidden="true" />}
            </p>
            {!finished && <Button size="sm" variant="danger" onClick={stopStreaming}><Icon name="stop" size={11} />Stop</Button>}
          </div>
        );
      })()}

      {!stream && reply && (
        <div className="mb-msg mb-msg--assistant lab-in">
          <p>
            {reply.text}
            {reply.stopped && <span className="mb-stopped">Stopped</span>}
          </p>
          <div className="lab-row mb-msg-foot">
            {user.replies.length > 1 && (
              <span className="mb-pager">
                <button type="button" onClick={prevReply} disabled={replyIdx === 0} aria-label="Previous reply">
                  <Icon name="chevron" size={11} />
                </button>
                {replyIdx + 1} / {user.replies.length}
                <button type="button" onClick={nextReply} disabled={replyIdx === user.replies.length - 1} aria-label="Next reply">
                  <Icon name="chevron" size={11} />
                </button>
              </span>
            )}
            <button type="button" className="mb-edit-btn" onClick={regenerate}>Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
}
