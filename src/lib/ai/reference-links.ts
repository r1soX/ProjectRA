export function aiReferenceHref(reference: {
  type: "user" | "project" | "task";
  id: string;
  boardId?: string;
}) {
  if (reference.type === "project") return `/boards/${reference.id}`;
  if (reference.type === "task" && reference.boardId) {
    return `/boards/${reference.boardId}?task=${reference.id}`;
  }
  return null;
}
