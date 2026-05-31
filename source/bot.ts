import { ActivityType, ApplicationCommand, Client, Events, IntentsBitField, MessageFlags, Partials, REST, Routes, TimestampStyles } from "discord.js";
import { promises as fsa } from "fs";
import cron from "node-cron";
import path from "path";
import { Sequelize } from "sequelize";
import { Company } from "./database/models/index.ts";
import { addButtonsToCooldownDictionary, getButton, linkAllButtonsToLogic } from "./frontend/buttons/_buttonDictionary.js";
import type { MessageComponentFunctionality } from './frontend/classes/index.js';
import { addCommandsToCooldownDictionary, addCommandsToPremiumList, getCommand, linkAllCommandsToLogic, slashData } from "./frontend/commands/_commandDictionary.ts";
import { addContextMenusToCooldownDictionary, addContextMenusToPremiumList, contextMenuData, getContextMenu, linkAllContextMenusToLogic as setContextMenuLogic } from "./frontend/context_menus/_contextMenuDictionary.js";
import { addItemsToCooldownDictionary, linkAllItemsToLogic } from "./frontend/items/_itemDictionary.js";
import { addSelectsToCooldownDictionary, getSelect, linkAllSelectsToLogic } from "./frontend/selects/_selectDictionary.js";
import { commandMention, consolidateHunterReceipts, goalCompletionEmbed, latestVersionChangesEmbed, randomCongratulatoryPhrase, refreshReferenceChannelScoreboardOverall, refreshReferenceChannelScoreboardSeasonal, rewardSummary, secondingButtonRow, sendRewardMessage, syncRankRoles, toastEmbed } from "./frontend/shared/index.js";
import logicBlob from "./logic/index.js";
import { announcementsChannelId, commandIds, lastPostedVersion, premium, SAFE_DELIMITER, SKIP_INTERACTION_HANDLING, testGuildId } from "./shared/constants.ts";
import { discordTimestamp } from "./shared/index.js";
import { CooldownDictionary, PremiumFlowList } from "./shared/types.ts";

const runMode = process.argv[4] || "development";

const log = console.log;

console.log = function () {
	log.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} ${runMode} mode`, ...arguments]);
}

const error = console.error;

console.error = function () {
	error.apply(console, [`${discordTimestamp(Math.floor(Date.now() / 1000))} ${runMode} mode`, ...arguments]);
}

//#region pre-Client Setup
const cooldownDictionary: CooldownDictionary = {};
addCommandsToCooldownDictionary(cooldownDictionary);
addButtonsToCooldownDictionary(cooldownDictionary);
addSelectsToCooldownDictionary(cooldownDictionary);
addContextMenusToCooldownDictionary(cooldownDictionary);
addItemsToCooldownDictionary(cooldownDictionary);

const premiumFlowList: PremiumFlowList = [];
addCommandsToPremiumList(premiumFlowList);
addContextMenusToPremiumList(premiumFlowList);
//#endregion

//#region Shard Instances
const dbConnection = new Sequelize(require(__dirname + '/../config/config.json')[runMode]);
const models = {};

const dAPIClient = new Client({
	presence: {
		activities: [{
			type: ActivityType.Custom,
			name: "🔰 Get started with /tutorial"
		}]
	},
	partials: [Partials.GuildMember, Partials.Message, Partials.Reaction],
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildMessageReactions]
});
//#endregion

//#region Database Setup
const basename = path.basename(__filename);
const isDevMode = runMode === "development";
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

	if (isDevMode) dbConnection.sync();

	for (const branch in logicBlob) { // Set the database for the logic files that store it
		logicBlob[branch].setDB?.(dbConnection);
	}

	linkAllCommandsToLogic(logicBlob);
	linkAllButtonsToLogic(logicBlob);
	linkAllSelectsToLogic(logicBlob);
	setContextMenuLogic(logicBlob);
	linkAllItemsToLogic(logicBlob);

	return;
}).catch(console.error);
//#endregion

const authPath = "../config/auth.json";
dAPIClient.login((await import(authPath)).default.token);

//#region Event Handlers
dAPIClient.on(Events.ClientReady, () => {
	if (!dAPIClient.user) {
		console.error(`${Events.ClientReady} receieved with falsey Client.user`);
		return;
	}
	console.log(`Connected as ${dAPIClient.user.tag}`);
	if (!isDevMode) {
		(() => {
			try {
				new REST({ version: "10" }).setToken(require(authPath).token).put(
					Routes.applicationCommands(dAPIClient.user.id),
					{ body: [...slashData, ...contextMenuData] }
				).then(commands => {
					if (!(function responseIsApplicationCommands(commands: unknown): commands is ApplicationCommand[] {
						return Array.isArray(commands) && commands.every(command => "id" in command && "name" in command);
					})(commands)) {
						throw new Error("Production command upload received a response that was not ApplicationCommand[]");
					}
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

				latestVersionChangesEmbed().then(embed => {
					dAPIClient.guilds.fetch(testGuildId).then(guild => {
						guild.channels.fetch(announcementsChannelId).then(announcementsChannel => {
							if (!announcementsChannel) {
								throw new Error("Could not find BountyBot Announcements channel in IHP Server");
							}
							if (!announcementsChannel.isSendable()) {
								throw new Error("BountyBot Announcements channel is a non-sendable channel type");
							}
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
	if (!interaction.guild) return; // DM interactions not supported

	let mainId;
	if (interaction.isAutocomplete()) { // Autocomplete interactions have the least generalizable handling
		mainId = interaction.commandName;
		const command = getCommand(mainId);
		const focusedOption = interaction.options.getFocused(true);
		const unfilteredChoices = command.autocomplete?.[focusedOption.name] ?? [];
		if (unfilteredChoices.length < 1) {
			console.error(`Attempted autocomplete on misconfigured command ${mainId} ${focusedOption.name}`);
		}
		const choices = unfilteredChoices.filter(choice => choice.value.toLowerCase().includes(focusedOption.value.toLowerCase()))
			.slice(0, 25);
		interaction.respond(choices);
		return;
	}

	let args;
	/**
	 * Slash Command and Context Menu do not have a `customId` property,
	 * but also will not need to signal to skip interaction handling
	 */
	if (interaction.isCommand() || interaction.isContextMenuCommand()) {
		mainId = interaction.commandName;
	} else if (interaction.customId.startsWith(SKIP_INTERACTION_HANDLING)) {
		return;
	} else {
		[mainId, ...args] = interaction.customId.split(SAFE_DELIMITER);
	}

	await dbReady;

	const origin = await logicBlob.companies.getInteractionOrigin(interaction);

	//#region Ban Check
	if (origin.hunter.isBanned && !(interaction.isCommand() && mainId === "moderation")) {
		interaction.reply({ content: `You are banned from interacting with BountyBot on ${interaction.guild.name}.`, flags: MessageFlags.Ephemeral });
		return;
	}
	//#endregion

	//#region Premium Checks
	if (premiumFlowList.includes(mainId) && !premium.paid.includes(interaction.user.id) && !premium.gift.includes(interaction.user.id)) {
		interaction.reply({ content: `The \`/${mainId}\` BountyBot function is a premium command. Learn more with ${commandMention("premium")}.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	//#endregion

	// #region General Cooldown Management
	const commandTime = new Date();
	//TODONOW improve return type reporting of `cooldownTimestamp` and `lastCommandName`
	const { isOnGeneralCooldown, isOnCommandCooldown, cooldownTimestamp, lastCommandName } = await logicBlob.cooldowns.checkCooldownState(interaction.user.id, mainId, commandTime);
	if (isOnGeneralCooldown) {
		interaction.reply({ content: `Please wait, you are on BountyBot cooldown from using \`${lastCommandName}\` recently. Try again ${discordTimestamp(Math.floor(cooldownTimestamp.getTime() / 1000), TimestampStyles.RelativeTime)}.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	if (isOnCommandCooldown) {
		interaction.reply({ content: `Please wait, \`/${mainId}\` is on cooldown. It can be used again ${discordTimestamp(Math.floor(cooldownTimestamp.getTime() / 1000), TimestampStyles.RelativeTime)}.`, flags: [MessageFlags.Ephemeral] });
		return;
	}
	await logicBlob.cooldowns.updateCooldowns(interaction.user.id, mainId, commandTime, cooldownDictionary[mainId]);
	//#endregion

	//#region Command execution
	if (interaction.isContextMenuCommand()) {
		getContextMenu(mainId).execute(interaction, origin, isDevMode);
	} else if (interaction.isCommand()) {
		getCommand(mainId).execute(interaction, origin, isDevMode);
	} else {
		let interactionWrapper: MessageComponentFunctionality;
		if (interaction.isButton()) {
			interactionWrapper = getButton(mainId);
		} else if (interaction.isAnySelectMenu()) {
			interactionWrapper = getSelect(mainId);
		}

		interactionWrapper.execute(interaction, origin, runMode, args);
	}
	//#endregion
});

dAPIClient.on(Events.MessageReactionAdd, async (reaction, user) => {
	await dbReady;
	if (reaction.emoji.name !== "🥂") {
		return;
	}

	// Reject DM reactions (which lack `.message.guild` and `.message.guildId`), but keep Partials (which lack `.message.guild`)
	if (!reaction.message.guildId) {
		return;
	}

	// If receiving a Partial, fetch entities
	let guild = reaction.message.guild;
	let hostMessage = reaction.message;
	let hostChannel = hostMessage?.channel;
	if (reaction.partial) {
		guild = await dAPIClient.guilds.fetch(reaction.message.guildId);
		hostChannel = await guild.channels.fetch(reaction.message.channelId);
		hostMessage = await hostChannel.messages.fetch(reaction.message.id);
	}

	// Reject toasts on own message or toasts on bot messages if not in development mode
	if (!isDevMode && (hostMessage.author.bot || hostMessage.author.id === user.id)) {
		return;
	}

	// Reject in companies that have disabled reaction toasts
	const company = await logicBlob.companies.findCompanyByPK(guild.id);
	if (company.disableReactionToasts) {
		return;
	}

	// Reject if interacting user is banned from BountyBot
	const { hunter: [interactingHunter] } = await logicBlob.hunters.findOrCreateBountyHunter(user.id, guild.id);
	if (interactingHunter.isBanned) {
		return;
	}

	// Reject if message author is banned from BountyBot
	const { hunter: [authorHunter] } = await logicBlob.hunters.findOrCreateBountyHunter(hostMessage.author.id, guild.id);
	if (authorHunter.isBanned) {
		return;
	}

	// Reject if interacting user has already seconded toast
	const existingToast = await logicBlob.toasts.findToastByMessageId(hostMessage.id);
	if (existingToast && await logicBlob.toasts.wasAlreadySeconded(existingToast.id, user.id)) {
		return;
	}

	const previousCompanyLevel = Company.getLevel(company.getXP(await logicBlob.hunters.getCompanyHunterMap(guild.id)));
	const [season] = await logicBlob.seasons.findOrCreateCurrentSeason(guild.id);
	const descendingRanks = await logicBlob.ranks.findAllRanks(guild.id);
	const guildRoles = await guild.roles.fetch();
	let goalProgress;
	const recipientIds = [hostMessage.author.id];
	if (existingToast) {
		// If extant toast, create Seconding
		const companyReceipt = { guildName: guild.name };
		goalProgress = await logicBlob.goals.progressGoal(company, "secondings", interactingHunter, season);
		if (goalProgress.gpContributed > 0) {
			companyReceipt.gp = goalProgress.gpContributed;
		}
		const hunterReceipts = await logicBlob.toasts.secondToast(interactingHunter, existingToast, company, recipientIds, season.id);
		const toastMessage = await reaction.message.channel.messages.fetch(existingToast.toastMessageId);
		toastMessage.edit({ embeds: [toastEmbed(company.toastThumbnailURL, existingToast.text, recipientIds, await reaction.message.guild.members.fetch(user.id), goalProgress, existingToast.imageURL, await logicBlob.toasts.findSecondingMentions(existingToast.id))] });

		const participationMap = await logicBlob.seasons.getParticipationMap(season.id);
		const seasonalHunterReceipts = await logicBlob.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, guildRoles);
		syncRankRoles(seasonalHunterReceipts, descendingRanks, guild.members);
		consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
		const currentCompanyLevel = Company.getLevel(company.getXP(await logicBlob.hunters.getCompanyHunterMap(guild.id)));
		if (currentCompanyLevel > previousCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}
		if (company.scoreboardIsSeasonal) {
			refreshReferenceChannelScoreboardSeasonal(company, guild, participationMap, descendingRanks, goalProgress);
		} else {
			refreshReferenceChannelScoreboardOverall(company, guild, await logicBlob.hunters.getCompanyHunterMap(guild.id), goalProgress);
		}

		sendRewardMessage(toastMessage, `${user.toString()} seconded this toast!\n${rewardSummary("seconding", companyReceipt, hunterReceipts, company.maxSimBounties)}`, "Rewards");
	} else {
		// If no extant toast, create Toast
		const hunterMap = await logicBlob.hunters.getCompanyHunterMap(guild.id);
		const toastText = `${randomCongratulatoryPhrase()}! Reaction Toast: ${hostMessage.url}`;
		const { toastId, hunterReceipts } = await logicBlob.toasts.raiseToast(guild, company, user.id, recipientIds, hunterMap, season.id, toastText, null, hostMessage.id);

		const companyReceipt = { guildName: guild.name };
		const currentCompanyLevel = Company.getLevel(company.getXP(await logicBlob.hunters.getCompanyHunterMap(guild.id)));
		if (currentCompanyLevel > previousCompanyLevel) {
			companyReceipt.levelUp = currentCompanyLevel;
		}
		goalProgress = await logicBlob.goals.progressGoal(company, "toasts", interactingHunter, season);
		if (goalProgress.gpContributed > 0) {
			companyReceipt.gp = goalProgress.gpContributed;
		}

		reaction.message.channel.send({
			embeds: [toastEmbed(company.toastThumbnailURL, toastText, recipientIds, await guild.members.fetch(user.id), goalProgress)],
			components: [secondingButtonRow(toastId)],
		}).then(async message => {
			await logicBlob.toasts.setToastMessageId(toastId, message.id);
			if (hunterReceipts.size > 0) {
				const participationMap = await logicBlob.seasons.getParticipationMap(season.id);
				const seasonalHunterReceipts = await logicBlob.seasons.updatePlacementsAndRanks(participationMap, descendingRanks, guildRoles);
				syncRankRoles(seasonalHunterReceipts, descendingRanks, guild.members);

				consolidateHunterReceipts(hunterReceipts, seasonalHunterReceipts);
				sendRewardMessage(message, rewardSummary("toast", companyReceipt, hunterReceipts, company.maxSimBounties), "Rewards");
				if (company.scoreboardIsSeasonal) {
					refreshReferenceChannelScoreboardSeasonal(company, guild, participationMap, descendingRanks, goalProgress);
				} else {
					refreshReferenceChannelScoreboardOverall(company, guild, hunterMap, goalProgress);
				}
			}
		});
	}
	if (goalProgress.goalCompleted) {
		hostChannel.send({
			embeds: [goalCompletionEmbed(goalProgress.contributorIds)],
			flags: MessageFlags.SuppressNotifications
		});
	}
})

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

dAPIClient.on(Events.GuildMemberRemove, async guildMember => {
	await dbReady;
	const postingIds = await logicBlob.bounties.deleteHunterBountiesAndCompletionsFromCompany(guildMember.id, guildMember.guild.id);
	const company = await logicBlob.companies.findCompanyByPK(guildMember.guild.id);
	if (company.bountyBoardId) {
		const bountyBoard = await guildMember.guild.channels.fetch(company.bountyBoardId);
		for (const postingId of postingIds) {
			(await bountyBoard.threads.fetch(postingId)).delete("Poster removed from server");
		}
	}
	await logicBlob.toasts.deleteHunterToasts(guildMember.id, guildMember.guild.id);
	await logicBlob.seasons.deleteHunterParticipations(guildMember.id, guildMember.guild.id);
	await logicBlob.hunters.deleteHunter(guildMember.id, guildMember.guild.id);
})

dAPIClient.on(Events.GuildDelete, async guild => {
	await dbReady;
	logicBlob.toasts.deleteCompanyToasts(guild.id);
	logicBlob.bounties.deleteCompanyBounties(guild.id);
	logicBlob.seasons.deleteCompanySeasons(guild.id);
	logicBlob.goals.deleteCompanyGoals(guild.id);
	logicBlob.hunters.deleteCompanyHunters(guild.id);
	await logicBlob.ranks.findAllRanks(guild.id);
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
