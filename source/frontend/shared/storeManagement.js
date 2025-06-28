const { Hunter } = require("../../database/models");

/** Reloads a subset of a map of a Company's Hunters
 * @param {Map<string, Hunter>} hunterMap
 * @param {string[]} reloadIds
 */
async function reloadHunterMapSubset(hunterMap, reloadIds) {
	for (const id of reloadIds) {
		hunterMap.set(id, await hunterMap.get(id).reload());
	}
	return hunterMap;
}

module.exports = {
	reloadHunterMapSubset
};
