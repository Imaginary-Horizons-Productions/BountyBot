import { HunterReceiptMap } from "../../shared/types";

/** In place, updates the object value in `originalMap` with the objects for each id in an `addedMap` */
export function consolidateHunterReceipts(originalMap: HunterReceiptMap, ...addedMaps: HunterReceiptMap[]) {
	for (const addedMap of addedMaps) {
		for (const [id, addedReceipt] of addedMap) {
			if (Object.keys(addedReceipt).length > 0) {
				const existingReciept = originalMap.get(id) ?? {};
				originalMap.set(id, { ...existingReciept, ...addedReceipt });
			}
		}
	}
}
