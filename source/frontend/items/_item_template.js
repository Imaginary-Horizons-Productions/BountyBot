const { ItemTemplate, ItemTemplateSet } = require("../classes");

/** @type {typeof import("../../logic")} */
let logicLayer;

const itemName = "";
module.exports = new ItemTemplateSet(
	new ItemTemplate(itemName, "description", 3000,
		/** specs */
		async (interaction, origin) => {

		})
).setLogicLinker(logicBlob => {
	logicLayer = logicBlob;
});
