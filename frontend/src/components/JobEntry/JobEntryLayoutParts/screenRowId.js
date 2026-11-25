// Screen ids of rows made in bulk (a 200-item ex-bond, a loaded job): Date.now() + Math.random() repeated ids at that
// size, and Modify / Delete of one row then hit the other one too.
let rowSequence = 0;
const rowIdBase = Date.now() * 1000;

export const newRowId = () => rowIdBase + (++rowSequence);
