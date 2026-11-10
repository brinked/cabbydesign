// Designer actions that need feedback around them: a confirmation before
// something destructive, and an Undo toast after.
import { catalogById } from '../model/catalog';
import { useStore } from '../state/store';
import { confirmAsk, toast } from './Feedback';

const undoAction = { label: 'Undo', run: () => useStore.getState().undo() };

/** Remove a wall; asks first when it would take cabinets with it. */
export async function removeWallAsk(wallId: string): Promise<void> {
  const s = useStore.getState();
  const wall = s.design.walls.find((w) => w.id === wallId);
  if (!wall) return;
  const n = s.design.items.filter((it) => it.wallId === wallId && !it.auto).length;
  if (n > 0) {
    const ok = await confirmAsk({
      title: `Remove ${wall.name}?`,
      message: `This also removes the ${n} cabinet${n === 1 ? '' : 's'} on it. You can undo this afterwards.`,
      confirmLabel: 'Remove wall',
      danger: true,
    });
    if (!ok) return;
  }
  useStore.getState().removeWall(wallId);
  toast(`${wall.name} removed`, undoAction);
}

/** Remove a cabinet and offer Undo. */
export function removeItemWithUndo(itemId: string): void {
  const s = useStore.getState();
  const it = s.design.items.find((i) => i.id === itemId);
  if (!it) return;
  const name = catalogById(it.catalogId).name;
  s.removeItem(itemId);
  toast(`${name} removed`, undoAction);
}

/** Fill a wall's free space with cabinets and say what happened. */
export function fillWallNotify(wallId: string): void {
  const added = useStore.getState().fillWall(wallId);
  if (added > 0) toast(`Added ${added} cabinet${added === 1 ? '' : 's'} — move, swap or remove any of them`, undoAction);
  else toast('No room left on this wall for another cabinet');
}

/** Keyboard shortcuts for the designer screen. Returns the handler to attach. */
export function designerKeyHandler(e: KeyboardEvent): void {
  const s = useStore.getState();
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

  if (e.key === 'Escape') {
    if (s.addToWallId) s.openAdd(null);
    else if (s.editingId) s.openEditor(null);
    else if (s.editingRoughInId) s.openRoughIn(null);
    else if (s.editingOpeningId) s.openOpening(null);
    else if (s.selectedId && !typing) s.select(null);
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  // the remaining keys act on the selected cabinet, when no dialog is open
  if (s.addToWallId || s.editingId || s.editingRoughInId || s.editingOpeningId || !s.selectedId) return;
  const it = s.design.items.find((i) => i.id === s.selectedId);
  if (!it || it.auto) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removeItemWithUndo(it.id);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const step = e.shiftKey ? 0.125 : 1;
    s.moveItem(it.id, Math.max(0, it.x + (e.key === 'ArrowLeft' ? -step : step)));
    useStore.getState().reflowAll(it.id);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    s.openEditor(it.id);
  }
}
