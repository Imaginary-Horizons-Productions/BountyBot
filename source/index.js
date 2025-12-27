const { discordTimestamp } = require('./shared/index.js');
const log = console.log;

console.log = function () {
	log.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} `, ...arguments]);
}

const error = console.error;

console.error = function () {
	error.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} `, ...arguments]);
}

//#region Imports
const fsa = require('fs').promises;
const { Sequelize } = require('sequelize');
const path = require('path');
const basename = path.basename(__filename);
const { Client, ActivityType, IntentsBitField, Events, Routes, REST, MessageFlags, TimestampStyles } = require("discord.js");
const { MessageComponentWrapper, InteractionOrigin } = require('./frontend/classes');
const cron = require('node-cron');

const { getCommand, slashData, setLogic: setCommandLogic, updateCooldownMap: updateCommandCooldownMap, updatePremiumList: updatePremiumCommands } = require("./frontend/commands/_commandDictionary.js");
const { getButton, setLogic: setButtonLogic, updateCooldownMap: updateButtonCooldownMap } = require("./frontend/buttons/_buttonDictionary.js");
const { getSelect, setLogic: setSelectLogic, updateCooldownMap: updateSelectCooldownMap } = require("./frontend/selects/_selectDictionary.js");
const { getContextMenu, contextMenuData, setLogic: setContextMenuLogic, updateCooldownMap: updateContextMenuCooldownMap, updatePremiumList: updatePremiumContextMenus } = require("./frontend/context_menus/_contextMenuDictionary.js");
const { setLogic: setItemLogic, updateCooldownMap: updateItemCooldownMap } = require("./frontend/items/_itemDictionary.js")
const { SAFE_DELIMITER, authPath, testGuildId, announcementsChannelId, lastPostedVersion, premium, SKIP_INTERACTION_HANDLING, commandIds } = require("./constants.js");
const { buildVersionEmbed, commandMention } = require("./frontend/shared");
const logicBlob = require("./logic");
const runMode = process.argv[4] || "development";
const cooldownMap = {};
const premiumCommandList = [];
//#endregion

//#region pre-Client Setup
updateCommandCooldownMap(cooldownMap);
updateButtonCooldownMap(cooldownMap);
updateSelectCooldownMap(cooldownMap);
updateContextMenuCooldownMap(cooldownMap);
updateItemCooldownMap(cooldownMap);

updatePremiumCommands(premiumCommandList);
updatePremiumContextMenus(premiumCommandList);
//#endregion

//#region Shard Instances
const dbConnection = new Sequelize(require(__dirname + '/../config/config.json')[runMode]);
const models = {};

const dAPIClient = new Client({
	retryLimit: 5,
	presence: {
		activities: [{
			type: ActivityType.Custom,
			name: "🔰 Get started with /tutorial"
		}]
	},
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages]
});
//#endregion

//#region Database Setup
const dbReady = dbConnection.authenticate().then(async () => {
	return (await fsa.readdir(path.join(__dirname, "database", "models"))).filter(directory => directory.indexOf('.') === -1);
}).then(directories => {
	return Promise.all(directories.map(async directory => {
		const files = (await fsa.readdir(path.join(__dirname, "database", "models", directory))).filter(file =>
			file.indexOf('.') !== 0 &&
			file !== basename &&
			file.slice(-3) === '.js' &&
			file.indexOf('.test.js') === -1
		);

		return files.map(file => {
			const model = require(path.join(__dirname, "database", "models", directory, file)).initModel(dbConnection);
			models[model.name] = model;
		});
	}));
}).then(() => {
	Object.keys(models).map(modelName => {
		if (models[modelName].associate) {
			models[modelName].associate(models);
		}
	});

	if (runMode !== 'production') dbConnection.sync();

	for (const interface in logicBlob) { // Set the database for the logic files that store it
		logicBlob[interface].setDB?.(dbConnection);
	}

	setCommandLogic(logicBlob);
	setButtonLogic(logicBlob);
	setSelectLogic(logicBlob);
	setContextMenuLogic(logicBlob);
	setItemLogic(logicBlob);

	return;
}).catch(console.error);
//#endregion

dAPIClient.login(require(authPath).token);

//#region Event Handlers
dAPIClient.on(Events.ClientReady, () => {
	console.log(`Connected as ${dAPIClient.user.tag} -- Run Mode: ${runMode}`);
	if (runMode === "production") {
		(() => {
			try {
				new REST({ version: 10 }).setToken(require(authPath).token).put(
					Routes.applicationCommands(dAPIClient.user.id),
					{ body: [...slashData, ...contextMenuData] }
				).then(commands => {
					for (const command of commands) {
						commandIds[command.name] = command.id;
					}
				})
			} catch (error) {
				console.error(error);
			}
		})()

		// Post Changelog
		if (announcementsChannelId) {
			fsa.readFile('./ChangeLog.md', { encoding: 'utf8' }).then(data => {
				let [currentFull, currentMajor, currentMinor, currentPatch] = data.match(/(\d+)\.(\d+)\.(\d+)/);
				let [_lastFull, lastMajor, lastMinor, lastPatch] = lastPostedVersion.match(/(\d+)\.(\d+)\.(\d+)/);

				if (parseInt(currentMajor) <= parseInt(lastMajor) && parseInt(currentMinor) <= parseInt(lastMinor) && parseInt(currentPatch) <= parseInt(lastPatch)) {
					return;
				}

				buildVersionEmbed(dAPIClient.user.displayAvatarURL()).then(embed => {
					dAPIClient.guilds.fetch(testGuildId).then(guild => {
						guild.channels.fetch(announcementsChannelId).then(announcementsChannel => {
							announcementsChannel.send({ embeds: [embed] }).then(message => {
								message.crosspost();
								fsa.writeFile('./config/versionData.json', JSON.stringify({
									announcementsChannelId,
									lastPostedVersion: currentFull,
								}), "utf-8");
							});
						})
					})
				}).catch(console.error);
			});
		} else {
			console.error("Patch notes post skipped due to falsy announcementsChannelId");
		}
	} else {
		dAPIClient.application.commands.fetch({ guildId: testGuildId }).then(commands => {
			commands.each(command => {
				commandIds[command.name] = command.id;
			})
		});
	}
});

dAPIClient.on(Events.InteractionCreate, async interaction => {
	if (interaction.customId?.startsWith(SKIP_INTERACTION_HANDLING)) return; // Early out for interactions that do not require direct handling

	await dbReady;

	let mainId, args;
	if (interaction.isCommand() || interaction.isContextMenuCommand() || interaction.isAutocomplete()) {
		mainId = interaction.commandName;
	} else {
		[mainId, ...args] = interaction.customId.split(SAFE_DELIMITER);
	}

	/** @type {InteractionOrigin} */
	const origin = { company: (await logicBlob.companies.findOrCreateCompany(interaction.guild.id))[0] };
	const { user: [user], hunter: [hunter] } = await logicBlob.hunters.findOrCreateBountyHunter(interaction.user.id, interaction.guild.id);
	origin.user = user;
	origin.hunter = hunter;
	//#region Ban Check
	if (origin.hunter.isBanned && !(interaction.isCommand() && mainId === "moderation")) {
		interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: MessageFlags.Ephemeral });
		return;
	}
	//#endregion

	//#region Premium Checks
	if (premiumCommandList.includes(mainId) && !premium.paid.includes(interaction.user.id) && !premium.gift.includes(interaction.user.id)) {
		interaction.reply({ content: `The \`/${mainId}\` BountyBot function is a premium command. Learn more with ${commandMention("premium")}.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	//#endregion

	// #region General Cooldown Management
	if (!interaction.isAutocomplete()) { // Only run cooldowns on valid command types
		const commandTime = new Date();
		const { isOnGeneralCooldown, isOnCommandCooldown, cooldownTimestamp, lastCommandName } = await logicBlob.cooldowns.checkCooldownState(interaction.user.id, mainId, commandTime);
		if (isOnGeneralCooldown) {
			interaction.reply({ content: `Please wait, you are on BountyBot cooldown from using \`${lastCommandName}\` recently. Try again ${discordTimestamp(Math.floor(cooldownTimestamp.getTime() / 1000), TimestampStyles.RelativeTime)}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		if (isOnCommandCooldown) {
			interaction.reply({ content: `Please wait, \`/${mainId}\` is on cooldown. It can be used again ${discordTimestamp(Math.floor(cooldownTimestamp.getTime() / 1000), TimestampStyles.RelativeTime)}.`, flags: [MessageFlags.Ephemeral] });
			return;
		}
		logicBlob.cooldowns.updateCooldowns(interaction.user.id, mainId, commandTime, cooldownMap[mainId]);
	}
	//#endregion

	//#region Command execution
	if (interaction.isAutocomplete()) {
		const command = getCommand(mainId);
		const focusedOption = interaction.options.getFocused(true);
		const unfilteredChoices = command.autocomplete?.[focusedOption.name] ?? [];
		if (unfilteredChoices.length < 1) {
			console.error(`Attempted autocomplete on misconfigured command ${mainId} ${focusedOption.name}`);
		}
		const choices = unfilteredChoices.filter(choice => choice.value.toLowerCase().includes(focusedOption.value.toLowerCase()))
			.slice(0, 25);
		interaction.respond(choices);
	} else if (interaction.isContextMenuCommand()) {
		getContextMenu(mainId).execute(interaction, origin, runMode);
	} else if (interaction.isCommand()) {
		getCommand(mainId).execute(interaction, origin, runMode);
	} else {
		/** @type {MessageComponentWrapper} */
		let interactionWrapper;
		if (interaction.isButton()) {
			interactionWrapper = getButton(mainId);
		} else if (interaction.isAnySelectMenu()) {
			interactionWrapper = getSelect(mainId);
		}

		interactionWrapper.execute(interaction, origin, runMode, args);
	}
	//#endregion
});

dAPIClient.on(Events.ChannelDelete, async channel => {
	await dbReady;
	logicBlob.companies.findCompanyByPK(channel.guild.id).then(company => {
		if (company) {
			let shouldSaveCompany = false;
			if (channel.id === company.bountyBoardId) {
				company.bountyBoardId = null;
				shouldSaveCompany = true;
			} else if (channel.id === company.scoreboardChannelId) {
				company.scoreboardChannelId = null;
				company.scoreboardMessageId = null;
				shouldSaveCompany = true;
			}
			if (shouldSaveCompany) {
				company.save();
			}
		}
	})
});

dAPIClient.on(Events.MessageDelete, async message => {
	await dbReady;
	logicBlob.companies.findCompanyByPK(message.guild.id).then(company => {
		if (message.id === company.scoreboardMessageId) {
			company.scoreboardMessageId = null;
			company.save();
		}
	})
});

dAPIClient.on(Events.ThreadDelete, async thread => {
	await dbReady;
	logicBlob.companies.findCompanyByPK(thread.guild.id).then(company => {
		if (thread.id === company.evergreenThreadId) {
			company.evergreenThreadId = null;
			company.save();
		}
	})
})

dAPIClient.on(Events.GuildDelete, async guild => {
	await dbReady;
	logicBlob.toasts.deleteCompanyToasts(guild.id);
	logicBlob.bounties.deleteCompanyBounties(guild.id);
	logicBlob.seasons.deleteCompanySeasons(guild.id);
	logicBlob.goals.deleteCompanyGoals(guild.id);
	logicBlob.hunters.deleteCompanyHunters(guild.id);
	(await logicBlob.ranks.findAllRanks(guild.id))
		.map(r => r.roleId)
		.filter(id => !!id)
		.forEach(id => guild.roles.delete(id, 'Cleaning up BountyBot roles during kick.'));
	logicBlob.ranks.deleteCompanyRanks(guild.id);
	logicBlob.companies.deleteCompany(guild.id);
});

cron.schedule('0 0 */1 * *', async runTime => { // Runs daily currently
	await dbReady;
	logicBlob.cooldowns.cleanCooldownData();
});

cron.schedule("0 0 1 * *", async runTime => { // Sweep used items at noon on day 1 of each month
	await dbReady;
	logicBlob.items.sweepUsed();
})
//#endregion
