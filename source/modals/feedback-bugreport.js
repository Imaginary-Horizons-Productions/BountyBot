const { EmbedBuilder } = require('discord.js');
const { InteractionWrapper } = require('../classes');
const { testGuildId, feedbackChannelId } = require('../constants');

const customId = "bugreport";
module.exports = new InteractionWrapper(customId, 3000,
	/** Serialize bug report data and send to test server */
	(interaction, args) => {
		if (!testGuildId || !feedbackChannelId) {
			interaction.reply({ content: "The test server is not yet configured to receive feedback, thanks for your patience.", ephemeral: true });
		}
		const errors = [];
		const embed = new EmbedBuilder().setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
			.setTitle(`Bug Report: ${interaction.fields.getTextInputValue("title")}`)
			.addFields(
				{ name: "Reporter", value: `<@${interaction.user.id}>` },
				{ name: "Steps to Reproduce", value: interaction.fields.getTextInputValue("steps") },
				{ name: "Actual Behavior", value: interaction.fields.getTextInputValue("actual") },
				{ name: "Expected Behavior", value: interaction.fields.getTextInputValue("expected") }
			);

		if (interaction.user.hexAccentColor) {
			embed.setColor(interaction.user.hexAccentColor);
		}

		const unvalidatedImageURL = interaction.fields.getTextInputValue("image");
		try {
			if (unvalidatedImageURL) {
				new URL(unvalidatedImageURL);
				embed.setImage(unvalidatedImageURL);
			}
		} catch (error) {
			errors.push(error.message);
		}

		interaction.client.guilds.fetch(testGuildId).then(testGuild => {
			return testGuild.channels.fetch(feedbackChannelId);
		}).then(feedbackChannel => {
			feedbackChannel.createInvite({ maxAge: 0 }).then(invite => {
				feedbackChannel.send({ embeds: [embed] });
				interaction.reply({ content: `Your bug report has been recorded${errors.length > 0 ? `, but the following errors were encountered: ${errors.join(", ")}` : ""}.You can join the Imaginary Horizons Productions test server to provide additional information here: ${invite.url}`, ephemeral: true })
			})
		})
	}
);
