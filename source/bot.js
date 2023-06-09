//#region Imports
const { Client, ActivityType, IntentsBitField, Events } = require("discord.js");
const { readFile, writeFile } = require("fs").promises;
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");

const { InteractionWrapper } = require("./classes/InteractionWrapper.js");
const { getCommand, slashData } = require("./commands/_commandDictionary.js");
const { getButton } = require("./buttons/_buttonDictionary.js");
const { getModal } = require("./modals/_modalDictionary.js");
const { getSelect } = require("./selects/_selectDictionary.js");
const { SAFE_DELIMITER, authPath, testGuildId, announcementsChannelId, lastPostedVersion } = require("./constants.js");
const { buildVersionEmbed } = require("./embedHelpers.js");
//#endregion

//#region Executing Code
const client = new Client({
	retryLimit: 5,
	presence: {
		activities: [{
			type: ActivityType.Listening,
			name: "/commands"
		}]
	},
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers]
});
const cooldowns = new Map();

client.login(require(authPath).token)
	.catch(console.error);
//#endregion

//#region Event Handlers
client.on(Events.ClientReady, () => {
	console.log(`Connected as ${client.user.tag}`);

	if (process.argv[4] === "prod") {
		(async () => {
			try {
				await new REST({ version: 9 }).setToken(require(authPath).token).put(
					Routes.applicationCommands(client.user.id),
					{ body: slashData }
				)
			} catch (error) {
				console.error(error);
			}
		})()

		// Post Changelog
		readFile('./ChangeLog.md', { encoding: 'utf8' }).then(data => {
			let [currentFull, currentMajor, currentMinor, currentPatch] = data.match(/(\d+)\.(\d+)\.(\d+)/);
			let [_lastFull, lastMajor, lastMinor, lastPatch] = lastPostedVersion.match(/(\d+)\.(\d+)\.(\d+)/);

			if (parseInt(currentMajor) <= parseInt(lastMajor)) {
				if (parseInt(currentMinor) <= parseInt(lastMinor)) {
					if (parseInt(currentPatch) <= parseInt(lastPatch)) {
						return;
					}
				}
			}

			buildVersionEmbed(client.user.displayAvatarURL()).then(embed => {
				client.guilds.fetch(testGuildId).then(guild => {
					guild.channels.fetch(announcementsChannelId).then(announcementsChannel => {
						announcementsChannel.send({ embeds: [embed] }).then(message => {
							message.crosspost();
							writeFile('./config/versionData.json', JSON.stringify({
								announcementsChannelId,
								lastPostedVersion: currentFull,
							}), "utf-8");
						});
					})
				})
			}).catch(console.error);
		});
	}
})

/** returns Unix Timestamp when cooldown will expire or null in case of expired or missing cooldown
 * @param {InteractionWrapper} interactionWrapper
 * @param {string} userId
 */
function getInteractionCooldownTimestamp({ customId, cooldown }, userId) {
	const now = Date.now();

	if (!cooldowns.has(customId)) {
		cooldowns.set(customId, new Map());
	}

	const timestamps = cooldowns.get(customId);
	if (timestamps.has(userId)) {
		const expirationTime = timestamps.get(userId) + cooldown;

		if (now < expirationTime) {
			return Math.round(expirationTime / 1000);
		} else {
			timestamps.delete(userId);
		}
	} else {
		timestamps.set(userId, now);
		setTimeout(() => timestamps.delete(userId), cooldown);
	}
	return null;
}

client.on(Events.InteractionCreate, interaction => {
	if (interaction.isCommand()) {
		const command = getCommand(interaction.commandName);
		const cooldownTimestamp = getInteractionCooldownTimestamp(command, interaction.user.id);
		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, the \`/${interaction.commandName}\` command is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, ephemeral: true });
			return;
		}

		command.execute(interaction);
	} else {
		const [mainId, ...args] = interaction.customId.split(SAFE_DELIMITER);
		let getter;
		if (interaction.isButton()) {
			getter = getButton;
		} else if (interaction.isStringSelectMenu()) {
			getter = getSelect;
		} else if (interaction.isModalSubmit()) {
			getter = getModal;
		}
		const interactionWrapper = getter(mainId);
		const cooldownTimestamp = getInteractionCooldownTimestamp(interactionWrapper, interaction.user.id);

		if (cooldownTimestamp) {
			interaction.reply({ content: `Please wait, this interaction is on cooldown. It can be used again <t:${cooldownTimestamp}:R>.`, ephemeral: true });
			return;
		}

		interactionWrapper.execute(interaction, args);
	}
})
//#endregion
