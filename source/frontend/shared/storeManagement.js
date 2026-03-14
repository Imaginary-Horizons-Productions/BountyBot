/** In place, updates the object value in `originalMap` with the objects for each id in an `addedMap`
 * @param {Map<string, {}>} originalMap
 * @param {...Map<string, {}>} addedMaps
 */
function consolidateHunterReceipts(originalMap, ...addedMaps) {
	for (const addedMap of addedMaps) {
		for (const [id, addedReceipt] of addedMap) {
			if (Object.keys(addedReceipt).length > 0) {
				const existingReciept = originalMap.get(id) ?? {};
				originalMap.set(id, { ...existingReciept, ...addedReceipt });
			}
		}
	}
}

module.exports = {
	consolidateHunterReceipts
};
