type NotePair = {
  previous_note_id: string;
  current_note_id: string;
};

/**
 * is_current compares the analysis note pair to the latest two consultation IDs.
 * Fewer than two notes => false. Order within the pair does not matter for equality.
 */
export function computeIsCurrent(
  latestNoteIds: string[],
  analysis: NotePair,
): boolean {
  if (latestNoteIds.length < 2) return false;
  const expected = new Set(latestNoteIds.slice(0, 2));
  return (
    expected.has(analysis.previous_note_id) &&
    expected.has(analysis.current_note_id) &&
    analysis.previous_note_id !== analysis.current_note_id
  );
}
