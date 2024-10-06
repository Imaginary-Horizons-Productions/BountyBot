const { PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { CommandWrapper } = require('../classes');
const { extractUserIdsFromMentions, textsHaveAutoModInfraction } = require('../util/textUtil');
const { raiseToast } = require('../engines/toastEngine');

const mainId = "toast";
module.exports = new CommandWrapper(mainId, "Raise a toast to other bounty hunter(s), usually granting +1 XP", PermissionFlagsBits.SendMessages, false, [InteractionContextType.Guild], 30000,
	/** Provide 1 XP to mentioned hunters up to author's quota (10/48 hours), roll for crit toast (grants author XP) */
	async (interaction, database, runMode) => {
		const toasterHunter = await database.models.Hunter.findOne({ where: { userId: interaction.user.id, companyId: interaction.guildId } });
		if (toasterHunter?.isBanned) {
			interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, ephemeral: true });
			return;
		}

		const errors = [];

		// Find valid toastees
		const toasteeIds = extractUserIdsFromMentions(interaction.options.getString("toastees"), [interaction.user.id]);

		const nonBotToasteeIds = [];
		if (toasteeIds.length < 1) {
			errors.push("Could not parse any user mentions from `toastees`.");
		} else {
			const toasteeMembers = (await interaction.guild.members.fetch({ user: toasteeIds })).values();
			for (const member of toasteeMembers) {
				if (runMode !== "prod" || !member.user.bot) {
					nonBotToasteeIds.push(member.id);
				}
			}

			if (nonBotToasteeIds.length < 1) {
				errors.push("Could not parse any non-bot mentions from `toastees`.");
			}
		}

		// Validate image-url is a URL
		const imageURL = interaction.options.getString("image-url");
		try {
			if (imageURL) {
				new URL(imageURL);
			}
		} catch (error) {
			errors.push(error.message);
		}

		// Early-out if any errors
		if (errors.length > 0) {
			interaction.reply({ content: `The following errors were encountered while raising your toast:\n- ${errors.join("\n- ")}`, ephemeral: true });
			return;
		}

		const toastText = interaction.options.getString("message");
		if (await textsHaveAutoModInfraction(interaction.channel, interaction.member, [toastText], "toast")) {
			interaction.reply({ content: "Your toast was blocked by AutoMod.", ephemeral: true });
			return;
		}

		raiseToast(interaction, database, nonBotToasteeIds, toastText, imageURL);
	}
).setOptions(
	{
		type: "String",
		name: "toastees",
		description: "The mention(s) of the bounty hunter(s) to whom you are raising a toast",
		required: true
	},
	{
		type: "String",
		name: "message",
		description: "The text of the toast to raise",
		required: true
	},
	{
		type: "String",
		name: "image-url",
		description: "The URL to the image to add to the toast",
		required: false
	}
);
