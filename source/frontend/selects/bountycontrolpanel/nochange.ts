import { ZERO_WIDTH_WHITE_SPACE } from "../../../shared/constants";
import { SelectOptionFunctionality } from "../../classes";

export default new SelectOptionFunctionality("nochange", async (interaction, theater, isDevMode, logicLayer, args) => {
	/* Discord Selects keep their selection after resolving. If a user wants to use the same command
	   twice in a row but doesn't want other changes to be applied (like to fix a typo in a previous
	   edit), they can move the selection to this option to intentionally do nothing.
	 */
	interaction.update({ content: ZERO_WIDTH_WHITE_SPACE });
});
