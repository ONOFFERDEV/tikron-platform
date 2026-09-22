function receiptTotals(receipt) {
  return receipt.operations.reduce((totals, operation) => {
    if (operation.accounting === 'charged') totals.charged += operation.actualCredits;
    if (['reserved', 'submitting', 'submitted', 'unknown'].includes(operation.accounting)) totals.unresolved += operation.expectedCredits;
    return totals;
  }, { charged: 0, unresolved: 0 });
}

export function allReceipts(journal) {
  return [...Object.values(journal.receipts), ...Object.values(journal.archivedReceipts ?? {}).flat()];
}

export function aggregate(journal) {
  return allReceipts(journal).reduce((totals, receipt) => {
    const current = receiptTotals(receipt); totals.charged += current.charged; totals.unresolved += current.unresolved; return totals;
  }, { charged: 0, unresolved: 0 });
}

export function taskClaims(journal, taskId) {
  return allReceipts(journal).flatMap(receipt => receipt.operations.filter(operation => operation.taskId === taskId).map(operation => ({ assetKey: receipt.assetKey, attemptId: receipt.attemptId, stage: operation.stage })));
}
