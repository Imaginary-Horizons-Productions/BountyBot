import { InteractionContextType, PermissionFlagsBits } from "discord.js";
import { CommandFunctionality } from "../classes/index.ts";
import { ConfigCompanyThumbnailsSettings } from "../shared/_types.ts";
import { configCompanyThumbnails } from "../shared/flows/configCompanyThumbnails.ts";

const mainId = "config-server-thumbnails-premium";
const thumbnailUpdateData: ConfigCompanyThumbnailsSettings = [
	{
		label: "Scoreboard Thumbnail",
		description: "Set an image to use as thumbnail on the scoreboard",
		payloadProperty: "scoreboardThumbnailURL"
	},
	{
		label: "Goal Completion Thumbnail",
		description: "Set an image to use as thumbnail in server goal completion messages",
		payloadProperty: "goalCompletionThumbnailURL"
	},
	{
		label: "Raffle Thumbnail",
		description: "Set an image to use as thumbnail in raffle winner messages",
		payloadProperty: "raffleThumbnailURL"
	}
];
export default new CommandFunctionality(mainId, "Configure thumbnails for server messages (Premium)", PermissionFlagsBits.ManageGuild, true, [InteractionContextType.Guild], 3000,
	async (interaction, theater, isDevMode) => {
		configCompanyThumbnails("Server Message Thumbnail", thumbnailUpdateData, interaction, theater.company);
	}
);
