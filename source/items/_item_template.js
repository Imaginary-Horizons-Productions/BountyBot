const { Item } = require("../classes");

/** @type {typeof import("../logic")} */
let logicLayer;

const itemName = "";
module.exports = new Item(itemName, "description", 3000,
	/** specs */
	async (interaction, database) => {

	}
);

module.exports.setLogic = (logicBlob) => {
	logicLayer = logicBlob;
}
