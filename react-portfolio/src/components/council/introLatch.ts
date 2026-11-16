// Whether this page load began as a first visit to the council.
//
// It is latched because the intro marks itself seen as it starts to leave,
// and re-reading storage at that moment would report a first visit as a
// return one and unmount the intro mid-exit. It is released when the intro
// actually ends, so that leaving for another page and coming back (the same
// page load, the same module) does not play it a second time.

let firstVisit: boolean | null = null;

/** True while this page load still owes the visitor the intro. `hasSeen` is only consulted the first time. */
export function readFirstVisit(hasSeen: () => boolean): boolean {
  return (firstVisit ??= !hasSeen());
}

/** The intro has ended, finished or skipped. From here on this is a return visit. */
export function endFirstVisit(): void {
  firstVisit = false;
}

/** Tests only: forget everything, as a fresh page load would. */
export function resetFirstVisitForTest(): void {
  firstVisit = null;
}
