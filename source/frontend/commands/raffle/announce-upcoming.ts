import { SlashCommandStringOption } from "discord.js";
import { SubcommandFunctionality } from "../../classes";
import { addCompanyAnnouncementPrefix } from "../../shared";

const announcementOption = new SlashCommandStringOption().setName("announcement")
	.setDescription("A timestamp and/or eligibilty requirements can encourage interaction")
	.setRequired(true);

export default new SubcommandFunctionality("announce-upcoming", "Announce an upcoming raffle",
	async function executeSubcommand(interaction, theater, isDevMode, logicLayer) {
		const announcement = interaction.options.getString(announcementOption.name, true);
		theater.company.update({ nextRaffleString: announcement });
		interaction.reply(addCompanyAnnouncementPrefix(theater.company, { content: announcement }));
	}
).setOptions(announcementOption);
