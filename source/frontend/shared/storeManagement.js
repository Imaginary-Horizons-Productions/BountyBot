const { Hunter } = require("../../database/models");

/** Reloads a subset of a map of a Company's Hunters
 * @param {Record<string, Hunter>} hunterMap
 * @param {string[]} reloadIds
 */
async function reloadHunterMapSubset(hunterMap, reloadIds) {
	for (const id of reloadIds) {
		hunterMap[id] = await hunterMap[id].reload();
	}
	return hunterMap;
}

module.exports = {
	reloadHunterMapSubset
};
