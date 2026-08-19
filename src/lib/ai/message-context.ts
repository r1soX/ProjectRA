export type StoredAiMessage = {
  role: "USER" | "ASSISTANT";
  body: string;
  references?: StoredAiReference[];
};

export type StoredAiReference = {
  type: "user" | "project" | "task";
  id: string;
  label: string;
  marker: string;
  detail?: string;
  boardId?: string;
  color?: string;
  initials?: string;
  avatar?: string | null;
  emoji?: string | null;
};

export function messageContent(message: StoredAiMessage) {
  if (message.role !== "USER" || !message.references?.length) return message.body;
  const references = message.references.map((reference) => ({
    type: reference.type,
    id: reference.id,
    label: reference.label,
    ...(reference.boardId ? { boardId: reference.boardId } : {}),
  }));
  return `${message.body}\n\n<projectra_references>${JSON.stringify(references)}</projectra_references>`;
}
